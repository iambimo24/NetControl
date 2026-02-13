"use client";

import { useRef, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import {WEB_SOCKET_URL, ROOM} from '@/constants'

export const VideoSender: React.FC<{}> = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>("new");
  const [socketConnected, setSocketConnected] = useState(false);

  useEffect(() => {
    if (socket) {
      const PC = new RTCPeerConnection({
        iceServers: [{ urls: [
          "stun:120.76.43.183:3478",
          "turn:120.76.43.183:3478"
        ],
        username: 'root',
        credential: 'chen6654Z',
      }],
      });

      setPeerConnection(PC);
      PC.addEventListener("connectionstatechange", () => {
        setConnectionState(PC.connectionState);
      });
      PC.addEventListener('icecandidate', event => {
        socket.emit('message', {
          room: ROOM,
          type: 'ice-candidate',
          payload: event.candidate
        });
      });

      socket.on('message', (_data) => {
        const data = JSON.parse(_data);
        switch(data.type) {
          case 'answer':
            if (PC.signalingState !== 'stable') {
              PC!.setRemoteDescription(data.payload);
            }
            break;
          case 'ice-candidate':
            PC!.addIceCandidate(data.payload);
            break;
        }
      })
    }
  }, [socket]);

  useEffect(() => {
    if(peerConnection && socket) {
      (async () => {
        const videoDom = videoRef.current!;
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        videoDom.srcObject = stream;
        setIsStreaming(true);
        stream.getTracks().forEach(track => {
          peerConnection.addTrack(track, stream);
        });

        // 添加track后再创建offer
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('message', {room: ROOM, type: 'offer', payload: offer});
      })();
    }
  }, [peerConnection, socket]);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative w-full max-w-md">
        <div className="absolute top-2 left-2 bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium z-10 flex items-center gap-2">
          <span>发送端</span>
          {socketConnected && (
            <span className="text-xs bg-blue-500 px-2 py-0.5 rounded-full">Socket ✓</span>
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
      <div className="flex items-center justify-between gap-2">
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
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          onClick={() => {
              if (socket) return;
              // const newSocket = io("http://120.76.43.183:8081");
              const newSocket = io("ws://localhost:8081");
              setSocket(newSocket);
              newSocket.on('connect', () => {
                setSocketConnected(true);
              });
            }
          }
        >
          {socketConnected ? '已连接' : '未连接'}
        </button>
      </div>
    </div>
  );
};

VideoSender.displayName = "VideoSender";
