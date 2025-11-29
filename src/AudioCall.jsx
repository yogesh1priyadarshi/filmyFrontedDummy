import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const userName = import.meta.env.VITE_METERED_USERNAME;
const password = import.meta.env.VITE_METERED_PASSWORD;
const CONVERSATION_API = import.meta.env.VITE_CONVERSATION_API;
const USER_API = import.meta.env.VITE_USER_API;
const SIGNALING_SERVER_URL = import.meta.env.VITE_SIGNALING_SERVER_URL;

const socket = io(SIGNALING_SERVER_URL);

export default function AudioCall() {
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const [remoteUserId, setRemoteUserId] = useState("");

  useEffect(() => {
    socket.on("connect", () => {
      console.log("Connected:", socket.id);
    });

    socket.on("incoming-call", handleIncomingCall);
    socket.on("call-answered", handleCallAnswered);
    socket.on("ice-candidate", handleNewIceCandidate);

    return () => {
      socket.off("incoming-call");
      socket.off("call-answered");
      socket.off("ice-candidate");
    };
  }, []);

  // ---------- Initialize PeerConnection ----------
  const createPeerConnection = () => {
    peerRef.current = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        {
          urls: [
            "turn:global.relay.metered.ca:80",
            "turn:global.relay.metered.ca:443",
            "turn:global.relay.metered.ca:443?transport=tcp",
          ],
          username: userName,
          credential: password,
        },
      ],
    });

    peerRef.current.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", {
          to: remoteUserId,
          candidate: event.candidate,
        });
      }
    };

    peerRef.current.ontrack = (event) => {
      remoteAudioRef.current.srcObject = event.streams[0];
    };
  };

  // ---------- Start Outgoing Call ----------
  const startCall = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });

    localStreamRef.current = stream;
    createPeerConnection();
    stream.getTracks().forEach((track) => {
      peerRef.current.addTrack(track, stream);
    });

    const offer = await peerRef.current.createOffer();
    await peerRef.current.setLocalDescription(offer);

    const userId = prompt("Enter remote user ID:");
    setRemoteUserId(userId);

    socket.emit("call-user", {
      to: userId,
      offer,
    });
  };

  // ---------- Handle Incoming Call ----------
  const handleIncomingCall = async ({ from, offer }) => {
    setRemoteUserId(from);

    const acceptCall = window.confirm("Incoming audio call. Accept?");
    if (!acceptCall) return;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });

    localStreamRef.current = stream;
    createPeerConnection();
    stream
      .getTracks()
      .forEach((track) => peerRef.current.addTrack(track, stream));

    await peerRef.current.setRemoteDescription(offer);
    const answer = await peerRef.current.createAnswer();
    await peerRef.current.setLocalDescription(answer);

    socket.emit("answer-call", { to: from, answer });
  };

  // ---------- Handle Call Answered ----------
  const handleCallAnswered = async ({ answer }) => {
    await peerRef.current.setRemoteDescription(answer);
  };

  // ---------- Handle ICE ----------
  const handleNewIceCandidate = async ({ candidate }) => {
    try {
      await peerRef.current.addIceCandidate(candidate);
    } catch (err) {
      console.log("Error adding ICE:", err);
    }
  };

  // ---------- End Call ----------
  const endCall = () => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    peerRef.current?.close();
    peerRef.current = null;
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Audio Call</h2>

      <button onClick={startCall}>Start Audio Call</button>
      <button onClick={endCall}>End Call</button>

      <audio ref={remoteAudioRef} autoPlay></audio>
    </div>
  );
}
