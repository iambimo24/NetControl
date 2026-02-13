"use client";

import { useRef, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import {WEB_SOCKET_URL, ROOM} from '@/constants';

export const VideoReceiver: React.FC<{}> = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [hasStream, setHasStream] = useState(false);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>("new");
  const [socketConnected, setSocketConnected] = useState(false);

  useEffect(() => {
    if (socket) {
      const PC = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
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
        console.log("Receiver: Message from WS", data);
        switch(data.type) {
          case 'offer':
            PC!.setRemoteDescription(data.payload).then(async () => {
              const answer = await PC!.createAnswer();
              await PC!.setLocalDescription(answer);
              socket.emit('message', {
                room: ROOM,
                type: 'answer',
                payload: answer
              });
            });
            break;
          case 'ice-candidate':
            PC!.addIceCandidate(data.payload);
            break;
        }
      })
    }
  }, [socket]);

  useEffect(() => {
    if(peerConnection) {
      peerConnection.ontrack = (event) => {
        console.log("Receiver: Received track", event.track.kind);

        // 重新创建 MediaStream 以确保正确渲染
        const stream = event.streams[0];

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        setHasStream(true);
        console.log("Receiver: Remote stream tracks:", stream.getTracks().length);
      };
    }
  }, [peerConnection]);


  return (
    <div className="flex flex-col gap-4">
      <div className="relative w-full max-w-md">
        <div className="absolute top-2 left-2 bg-green-600 text-white px-3 py-1 rounded-full text-sm font-medium z-10 flex items-center gap-2">
          <span>接收端</span>
          {socketConnected && (
            <span className="text-xs bg-green-500 px-2 py-0.5 rounded-full">Socket ✓</span>
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
              : "等待连接"}
          </span>
        </div>
        <button
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          onClick={() => {
            if (socket) return;
            // const newSocket = io(WEB_SOCKET_URL);
            const newSocket = io("ws://localhost:8081");
            setSocket(newSocket);
            newSocket.on('connect', () => {
              setSocketConnected(true);
              // 注册加入房间
              newSocket.emit('message', {
                  room: ROOM,
                  type: "join",
                  payload: { role: "receiver" }
              });
            });
          }}
        >
          {socketConnected ? '已连接' : '未连接'}
        </button>
      </div>
    </div>
  );
};

VideoReceiver.displayName = "VideoReceiver";
