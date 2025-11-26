import { Routes, Route } from "react-router-dom";
import Login from "./Login";
import Chat from "./Chat";
import List from "./List";
import ChatPage from "./ChatPage";
import VideoAudioCall from "./VideoAudioCall";


function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/list" element={<List />} />
      <Route path="/group" element={<ChatPage />} />
      <Route path="/chat/:id" element={<Chat />} />
      <Route path="/videoCall" element={<VideoAudioCall />} />
    </Routes>
  );
}

export default App;
