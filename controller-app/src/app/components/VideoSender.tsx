"use client";

import { useRef, useEffect, useState, useImperativeHandle, forwardRef } from "react";

interface VideoSenderProps {
  onStreamReady?: (stream: MediaStream) => void;
  onOffer?: (offer: RTCSessionDescriptionInit) => void;
  onIceCandidate?: (candidate: RTCIceCandidate) => void;
}

export interface VideoSenderHandle {
  setAnswer: (answer: RTCSessionDescriptionInit) => Promise<void>;
  addIceCandidate: (candidate: RTCIceCandidate) => Promise<void>;
}

export const VideoSender = forwardRef<VideoSenderHandle, VideoSenderProps>(
  ({ onStreamReady, onOffer, onIceCandidate }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
    const [isStreaming, setIsStreaming] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>("new");

    // 暴露方法给父组件
    useImperativeHandle(ref, () => ({
      setAnswer: async (answer: RTCSessionDescriptionInit) => {
        if (peerConnectionRef.current) {
          await peerConnectionRef.current.setRemoteDescription(answer);
          console.log("Sender: Set remote description (answer)");
        }
      },
      addIceCandidate: async (candidate: RTCIceCandidate) => {
        if (peerConnectionRef.current) {
          await peerConnectionRef.current.addIceCandidate(candidate);
          console.log("Sender: Added ICE candidate");
        }
      },
    }));

    useEffect(() => {
      let stream: MediaStream | null = null;
      let setupComplete = false;

      const startCamera = async () => {
        try {
          // 获取摄像头流
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 },
            audio: false,
          });

          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            setIsStreaming(true);
            setError(null);
          }

          if (onStreamReady) {
            onStreamReady(stream);
          }

          if (setupComplete) return;
          setupComplete = true;

          // 创建发送端 PeerConnection
          const peerConnection = new RTCPeerConnection({
            iceServers: [
              { urls: "stun:stun.l.google.com:19302" },
              { urls: "stun:stun1.l.google.com:19302" },
            ],
          });

          peerConnectionRef.current = peerConnection;

          // 添加流的所有轨道
          stream.getTracks().forEach((track) => {
            peerConnection.addTrack(track, stream!);
            console.log("Sender: Added track:", track.kind);
          });

          // 监听连接状态
          peerConnection.onconnectionstatechange = () => {
            console.log("Sender connection state:", peerConnection.connectionState);
            setConnectionState(peerConnection.connectionState);
          };

          // 监听 ICE 连接状态
          peerConnection.oniceconnectionstatechange = () => {
            console.log("Sender ICE connection state:", peerConnection.iceConnectionState);
          };

          // 监听 ICE candidates
          peerConnection.onicecandidate = (event) => {
            if (event.candidate && onIceCandidate) {
              console.log("Sender: ICE candidate", event.candidate.type);
              onIceCandidate(event.candidate);
            } else if (!event.candidate) {
              console.log("Sender: ICE gathering complete");
            }
          };

          // 创建并发送 offer
          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);
          console.log("Sender: Created and set local description (offer)");

          if (onOffer) {
            onOffer(offer);
          }
        } catch (err) {
          setError("无法访问摄像头，请确保已授予权限");
          console.error("Camera error:", err);
        }
      };

      startCamera();

      return () => {
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }
        if (peerConnectionRef.current) {
          peerConnectionRef.current.close();
          console.log("Sender: PeerConnection closed");
        }
      };
    }, [onStreamReady, onOffer, onIceCandidate]);

    return (
      <div className="flex flex-col gap-4">
        <div className="relative w-full max-w-md">
          <div className="absolute top-2 left-2 bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium z-10">
            发送端
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
  }
);

VideoSender.displayName = "VideoSender";
