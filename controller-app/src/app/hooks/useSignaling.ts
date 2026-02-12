import { useEffect, useRef, useCallback, useState } from "react";

interface SignalingMessage {
  type: "offer" | "answer" | "ice-candidate";
  payload: any;
}

interface UseSignalingOptions {
  room: string;
  onOffer?: (offer: RTCSessionDescriptionInit) => void;
  onAnswer?: (answer: RTCSessionDescriptionInit) => void;
  onIceCandidate?: (candidate: RTCIceCandidate, from: "sender" | "receiver") => void;
}

export const useSignaling = ({ room, onOffer, onAnswer, onIceCandidate }: UseSignalingOptions) => {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // 连接到信令服务器
    const ws = new WebSocket("ws://localhost:8081");
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("Connected to signaling server");
      setIsConnected(true);

      // 加入房间
      ws.send(JSON.stringify({
        room,
        type: "join",
        payload: {}
      }));
    };

    ws.onmessage = (event) => {
      try {
        const message: SignalingMessage = JSON.parse(event.data);
        console.log("Received signaling message:", message.type);

        switch (message.type) {
          case "offer":
            if (onOffer) {
              onOffer(message.payload);
            }
            break;
          case "answer":
            if (onAnswer) {
              onAnswer(message.payload);
            }
            break;
          case "ice-candidate":
            if (onIceCandidate) {
              onIceCandidate(message.payload.candidate, message.payload.from);
            }
            break;
        }
      } catch (error) {
        console.error("Error parsing signaling message:", error);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    ws.onclose = () => {
      console.log("Disconnected from signaling server");
      setIsConnected(false);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [room, onOffer, onAnswer, onIceCandidate]);

  const sendOffer = useCallback((offer: RTCSessionDescriptionInit) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        room,
        type: "offer",
        payload: offer
      }));
      console.log("Sent offer via signaling server");
    }
  }, [room]);

  const sendAnswer = useCallback((answer: RTCSessionDescriptionInit) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        room,
        type: "answer",
        payload: answer
      }));
      console.log("Sent answer via signaling server");
    }
  }, [room]);

  const sendIceCandidate = useCallback((candidate: RTCIceCandidate, from: "sender" | "receiver") => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        room,
        type: "ice-candidate",
        payload: { candidate, from }
      }));
      console.log(`Sent ICE candidate from ${from} via signaling server`);
    }
  }, [room]);

  return {
    isConnected,
    sendOffer,
    sendAnswer,
    sendIceCandidate
  };
};
