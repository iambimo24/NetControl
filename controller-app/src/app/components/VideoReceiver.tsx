"use client";

import { useRef, useEffect, useState } from "react";
import {WEB_SOCKET_URL, ROOM} from '@/constants';

export const VideoReceiver: React.FC<{}> = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const remoteStreamRef = useRef<MediaStream>(new MediaStream());
  const [hasStream, setHasStream] = useState(false);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>("new");
  const [wsConnected, setWsConnected] = useState(false);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let peerConnection: RTCPeerConnection | null = null;
    const pendingIceCandidates: RTCIceCandidate[] = [];

    const init = () => {
      // 1. 连接到信令服务器
      ws = new WebSocket(WEB_SOCKET_URL);
      wsRef.current = ws;

      // 2. 监听来自信令服务器的消息（在 onopen 之前设置）
      ws.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log("Receiver: Received message:", message.type);

          switch (message.type) {
            case "offer":
              // 创建 PeerConnection（如果还没有的话）
              if (!peerConnectionRef.current) {
                peerConnection = new RTCPeerConnection({
                  iceServers: [
                    { urls: "stun:stun.l.google.com:19302" },
                    { urls: "stun:stun1.l.google.com:19302" },
                  ],
                });

                peerConnectionRef.current = peerConnection;

                // 监听远程轨道
                peerConnection.ontrack = (event) => {
                  console.log("Receiver: Received track", event.track.kind);

                  // 重新创建 MediaStream 以确保正确渲染
                  const stream = event.streams[0] || remoteStreamRef.current;

                  if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                  }

                  setHasStream(true);
                  console.log("Receiver: Remote stream tracks:", stream.getTracks().length);
                };

                // 监听连接状态
                peerConnection.onconnectionstatechange = () => {
                  console.log("Receiver connection state:", peerConnection!.connectionState);
                  setConnectionState(peerConnection!.connectionState);
                };

                peerConnection.oniceconnectionstatechange = () => {
                  console.log("Receiver ICE connection state:", peerConnection!.iceConnectionState);
                };

                // 监听 ICE candidates 并发送到信令服务器
                peerConnection.onicecandidate = (event) => {
                  if (event.candidate && ws?.readyState === WebSocket.OPEN) {
                    console.log("Receiver: Sending ICE candidate", event.candidate.type);
                    ws.send(JSON.stringify({
                      ROOM,
                      type: "ice-candidate",
                      payload: {
                        candidate: event.candidate,
                        from: "receiver"
                      }
                    }));
                  } else if (!event.candidate) {
                    console.log("Receiver: ICE gathering complete");
                  }
                };
              }

              // 设置远程描述（offer）
              await peerConnectionRef.current.setRemoteDescription(message.payload);
              console.log("Receiver: Set remote description (offer)");

              // 处理之前缓存的 ICE candidates
              for (const candidate of pendingIceCandidates) {
                await peerConnectionRef.current.addIceCandidate(candidate);
                console.log("Receiver: Added pending ICE candidate");
              }
              pendingIceCandidates.length = 0;

              // 创建并发送 answer
              const answer = await peerConnectionRef.current.createAnswer();
              await peerConnectionRef.current.setLocalDescription(answer);
              console.log("Receiver: Created answer, sending to signaling server");

              if (ws?.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  ROOM,
                  type: "answer",
                  payload: answer
                }));
              }
              break;

            case "ice-candidate":
              if (message.payload.from === "sender") {
                if (peerConnection?.remoteDescription) {
                  await peerConnection.addIceCandidate(message.payload.candidate);
                  console.log("Receiver: Added ICE candidate from sender");
                } else {
                  // 缓存 ICE candidate，等待 remoteDescription 设置后再添加
                  pendingIceCandidates.push(message.payload.candidate);
                  console.log("Receiver: Cached ICE candidate (waiting for remote description)");
                }
              }
              break;
          }
        } catch (error) {
          console.error("Receiver: Error handling message:", error);
        }
      };

      ws.onopen = () => {
        console.log("Receiver: Connected to signaling server");
        setWsConnected(true);

        // 加入房间
        ws!.send(JSON.stringify({
          ROOM,
          type: "join",
          payload: { role: "receiver" }
        }));
      };

      ws.onerror = (error) => {
        console.error("Receiver: WebSocket error:", error);
      };

      ws.onclose = () => {
        console.log("Receiver: Disconnected from signaling server");
        setWsConnected(false);
      };
    };

    init();

    return () => {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        console.log("Receiver: PeerConnection closed");
      }
      remoteStreamRef.current.getTracks().forEach((track) => track.stop());
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative w-full max-w-md">
        <div className="absolute top-2 left-2 bg-green-600 text-white px-3 py-1 rounded-full text-sm font-medium z-10 flex items-center gap-2">
          <span>接收端</span>
          {wsConnected && (
            <span className="text-xs bg-green-500 px-2 py-0.5 rounded-full">WS ✓</span>
          )}
        </div>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full rounded-2xl shadow-lg bg-zinc-900 aspect-video object-cover"
        />
        {!hasStream && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-900 rounded-2xl">
            <div className="text-zinc-400 text-center px-4">
              <div className="text-2xl mb-2">📡</div>
              <div>等待视频流...</div>
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div
          className={`w-3 h-3 rounded-full ${
            connectionState === "connected"
              ? "bg-green-500"
              : connectionState === "connecting"
              ? "bg-yellow-500"
              : "bg-zinc-500"
          }`}
        />
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          {connectionState === "connected"
            ? "已连接"
            : connectionState === "connecting"
            ? "连接中"
            : "等待连接"}
        </span>
      </div>
    </div>
  );
};

VideoReceiver.displayName = "VideoReceiver";
