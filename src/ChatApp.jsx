import React, { useEffect, useState } from "react";
import axios from "axios";
import * as sdk from "matrix-js-sdk";

export default function ChatApp() {
  const [client, setClient] = useState(null);
  const [messages, setMessages] = useState([]);
  const [roomId, setRoomId] = useState("!@yogeshcool:matrix.org"); // replace with a real roomId
  const [message, setMessage] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);

  const handleLogin = async () => {
    try {
      const res = await axios.post("http://localhost:5000/login", {
        username,
        password,
      });

      const { access_token, user_id, home_server } = res.data;

      const matrixClient = sdk.createClient({
        baseUrl: `https://${home_server || "matrix.org"}`,
        accessToken: access_token,
        userId: user_id,
      });

      matrixClient.startClient();
      setClient(matrixClient);
      setLoggedIn(true);

      matrixClient.on("Room.timeline", (event, room) => {
        if (room.roomId === roomId && event.getType() === "m.room.message") {
          setMessages((prev) => [...prev, event.getContent().body]);
        }
      });
    } catch (err) {
      console.error("Login error:", err);
    }
  };

  const sendMessage = async () => {
    if (!client || !message.trim()) return;
    await client.sendEvent(roomId, "m.room.message", {
      msgtype: "m.text",
      body: message,
    });
    setMessage("");
  };

  if (!loggedIn) {
    return (
      <div style={{ textAlign: "center", marginTop: "100px" }}>
        <h2>Login to Matrix</h2>
        <input
          placeholder="Username"
          onChange={(e) => setUsername(e.target.value)}
        />
        <br />
        <input
          type="password"
          placeholder="Password"
          onChange={(e) => setPassword(e.target.value)}
        />
        <br />
        <button onClick={handleLogin}>Login</button>
      </div>
    );
  }

  return (
    <div style={{ width: "400px", margin: "40px auto" }}>
      <h3>Matrix Chat Room</h3>
      <div
        style={{
          height: "300px",
          overflowY: "auto",
          border: "1px solid gray",
          padding: "10px",
          marginBottom: "10px",
        }}
      >
        {messages.map((msg, i) => (
          <p key={i}>{msg}</p>
        ))}
      </div>
      <input
        style={{ width: "75%" }}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type a message..."
      />
      <button onClick={sendMessage}>Send</button>
    </div>
  );
}
