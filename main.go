package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
	webrtc "github.com/pion/webrtc/v3"
)

type SignalMessage struct {
	Type    string          `json:"type"`
	From    string          `json:"from"`
	To      string          `json:"to,omitempty"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

type server struct {
	mu      sync.RWMutex
	clients map[string]*websocket.Conn
	roles   map[string]string
}

func newServer() *server {
	return &server{
		clients: make(map[string]*websocket.Conn),
		roles:   make(map[string]string),
	}
}

func (s *server) handleWS(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("id")
	role := r.URL.Query().Get("role")
	if id == "" {
		http.Error(w, "missing id", http.StatusBadRequest)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("upgrade error:", err)
		return
	}

	s.mu.Lock()
	s.clients[id] = conn
	s.roles[id] = role
	s.mu.Unlock()

	log.Printf("connected id=%s role=%s", id, role)

	defer func() {
		s.mu.Lock()
		delete(s.clients, id)
		delete(s.roles, id)
		s.mu.Unlock()
		conn.Close()
		log.Printf("disconnected id=%s", id)
	}()

	for {
		var msg SignalMessage
		if err := conn.ReadJSON(&msg); err != nil {
			log.Println("read error:", err)
			return
		}

		// attach sender if missing
		if msg.From == "" {
			msg.From = id
		}

		if msg.To != "" {
			// direct forward
			s.mu.RLock()
			target, ok := s.clients[msg.To]
			s.mu.RUnlock()
			if ok {
				if err := target.WriteJSON(msg); err != nil {
					log.Printf("forward to %s error: %v", msg.To, err)
				}
			} else {
				// reply error
				resp := SignalMessage{Type: "error", From: "server", To: msg.From, Payload: json.RawMessage(fmt.Sprintf("\"target %s not found\"", msg.To))}
				conn.WriteJSON(resp)
			}
			continue
		}

		// broadcast to clients with opposite role (simple relay behavior)
		s.mu.RLock()
		for cid, c := range s.clients {
			if cid == id {
				continue
			}
			// if roles present, only forward to different role; otherwise forward to all
			if s.roles[id] != "" && s.roles[cid] != "" && s.roles[id] == s.roles[cid] {
				continue
			}
			if err := c.WriteJSON(msg); err != nil {
				log.Printf("broadcast to %s error: %v", cid, err)
			}
		}
		s.mu.RUnlock()
	}
}

func (s *server) handleList(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	type clientInfo struct {
		ID   string `json:"id"`
		Role string `json:"role"`
	}
	list := make([]clientInfo, 0, len(s.clients))
	for id, _ := range s.clients {
		list = append(list, clientInfo{ID: id, Role: s.roles[id]})
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(list)
}

func main() {
	// minimal reference to pion/webrtc so module is used here (server不用直接创建 PeerConnection)
	var _ webrtc.Configuration

	srv := newServer()
	http.HandleFunc("/ws", srv.handleWS)
	http.HandleFunc("/list", srv.handleList)

	addr := ":8081"
	log.Printf("信令服务器启动，监听 %s", addr)
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatal(err)
	}
}
