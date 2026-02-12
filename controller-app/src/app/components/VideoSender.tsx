"use client";

import { useRef, useEffect, useState } from "react";
import {WEB_SOCKET_URL, ROOM} from '@/constants'
export const VideoSender: React.FC<{}> = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>("new");
  const [wsConnected, setWsConnected] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let ws: WebSocket | null = null;
    let peerConnection: RTCPeerConnection | null = null;
    const pendingIceCandidates: RTCIceCandidate[] = [];

    const init = async () => {
      try {
        // 1. 获取摄像头流（先获取，避免权限提示延迟）
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsStreaming(true);
          setError(null);
        }

        // 2. 创建 PeerConnection
        peerConnection = new RTCPeerConnection({
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
          ],
        });
        peerConnectionRef.current = peerConnection;

        // 添加视频轨道
        stream.getTracks().forEach((track) => {
          peerConnection!.addTrack(track, stream!);
          console.log("Sender: Added track:", track.kind);
        });

        // 监听连接状态
        peerConnection.onconnectionstatechange = () => {
          console.log("Sender connection state:", peerConnection!.connectionState);
          setConnectionState(peerConnection!.connectionState);
        };

        peerConnection.oniceconnectionstatechange = () => {
          console.log("Sender ICE connection state:", peerConnection!.iceConnectionState);
        };

        // 监听 ICE candidates
        peerConnection.onicecandidate = (event) => {
          if (event.candidate && ws?.readyState === WebSocket.OPEN) {
            console.log("Sender: Sending ICE candidate", event.candidate.type);
            ws.send(JSON.stringify({
              ROOM,
              type: "ice-candidate",
              payload: {
                candidate: event.candidate,
                from: "sender"
              }
            }));
          } else if (!event.candidate) {
            console.log("Sender: ICE gathering complete");
          }
        };

        // 3. 连接到信令服务器
        ws = new WebSocket(WEB_SOCKET_URL);
        wsRef.current = ws;

        // 监听来自信令服务器的消息（在 onopen 之前设置）
        ws.onmessage = async (event) => {
          try {
            const message = JSON.parse(event.data);
            console.log("Sender: Received message:", message.type);

            switch (message.type) {
              case "answer":
                if (peerConnection!.signalingState !== "stable") {
                  await peerConnection!.setRemoteDescription(message.payload);
                  console.log("Sender: Set remote description (answer)");

                  // 处理之前缓存的 ICE candidates
                  for (const candidate of pendingIceCandidates) {
                    await peerConnection!.addIceCandidate(candidate);
                    console.log("Sender: Added pending ICE candidate");
                  }
                  pendingIceCandidates.length = 0;
                }
                break;

              case "ice-candidate":
                if (message.payload.from === "receiver") {
                  if (peerConnection!.remoteDescription) {
                    await peerConnection!.addIceCandidate(message.payload.candidate);
                    console.log("Sender: Added ICE candidate from receiver");
                  } else {
                    // 缓存 ICE candidate，等待 remoteDescription 设置后再添加
                    pendingIceCandidates.push(message.payload.candidate);
                    console.log("Sender: Cached ICE candidate (waiting for remote description)");
                  }
                }
                break;
            }
          } catch (error) {
            console.error("Sender: Error handling message:", error);
          }
        };

        ws.onopen = async () => {
          console.log("Sender: Connected to signaling server");
          setWsConnected(true);

          // 加入房间
          ws!.send(JSON.stringify({
            ROOM,
            type: "join",
            payload: { role: "sender" }
          }));

          // 等待一小段时间，确保接收端也已连接
          // await new Promise(resolve => setTimeout(resolve, 500));

          // 创建并发送 offer
          const offer = await peerConnection!.createOffer();
          await peerConnection!.setLocalDescription(offer);
          console.log("Sender: Created offer, sending to signaling server");

          ws!.send(JSON.stringify({
            ROOM,
            type: "offer",
            payload: offer
          }));
        };

        ws.onerror = (error) => {
          console.error("Sender: WebSocket error:", error);
          setError("信令服务器连接失败");
        };

        ws.onclose = () => {
          console.log("Sender: Disconnected from signaling server");
          setWsConnected(false);
        };

      } catch (err) {
        setError("无法访问摄像头，请确保已授予权限");
        console.error("Sender initialization error:", err);
      }
    };

    init();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        console.log("Sender: PeerConnection closed");
      }
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative w-full max-w-md">
        <div className="absolute top-2 left-2 bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium z-10 flex items-center gap-2">
          <span>发送端</span>
          {wsConnected && (
            <span className="text-xs bg-blue-500 px-2 py-0.5 rounded-full">WS ✓</span>
          )}
        </div>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full rounded-2xl shadow-lg bg-zinc-900 aspect-video object-cover"
        />
        {!isStreaming && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-900 rounded-2xl">
            <div className="text-zinc-400">正在启动摄像头...</div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-900 rounded-2xl">
            <div className="text-red-400 text-center px-4">{error}</div>
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
            : isStreaming
            ? "准备就绪"
            : "未连接"}
        </span>
      </div>
    </div>
  );
};

VideoSender.displayName = "VideoSender";
