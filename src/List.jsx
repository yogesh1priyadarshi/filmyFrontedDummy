import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function List() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const user = JSON.parse(localStorage.getItem("user"));
  console.log("all user from localStorage: ",user);
  const senderId = user?.id; // Ideally, get from auth context or localStorage
  const CONVERSATION_API = import.meta.env.VITE_CONVERSATION_API;
  const USER_API = import.meta.env.VITE_USER_API;


  const fetchAllUsers = async () => {
    try {
      const response = await axios.get(
        `${USER_API}/profile/fetchAll`,
        { withCredentials: true }
      );
      setUsers(response.data.data || []);
    } catch (err) {
      console.error("Error fetching users:", err);
      setError("Failed to fetch users.");
    } finally {
      setLoading(false);
    }
  };

  const handleClick = async (receiverId) => {
    try{
      console.log("receivedId ", receiverId);
    const conversation = await axios.post(CONVERSATION_API+"/conversations/",{senderId, receiverId});
    navigate(`/chat/${conversation.data?._id}`)

    }catch(err){
      console.log("error while creating conversation", err);
    }
    
  };

  useEffect(() => {
    fetchAllUsers();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-2xl text-blue-700">
        Loading users...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen text-2xl text-red-600">
        {error}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center py-10">
      <h1 className="text-3xl font-bold text-blue-900 mb-6">All Users {user?.userName} </h1>

      <div className="w-full max-w-3xl bg-white shadow-md rounded-xl p-6">
        {users.length === 0 ? (
          <p className="text-gray-600 text-center">No users found.</p>
        ) : (
          <ul className="space-y-4">
            {users.map((user) => (
              <li
                key={user._id}
                className="flex justify-between items-center border-b border-gray-200 pb-2"
              >
                <div>
                  <p className="text-lg font-medium text-gray-800">
                    {user.userName || "Unnamed User"}
                  </p>
                  <p className="text-gray-500 text-sm">{user.email}</p>
                </div>
                <button
                  className="text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                  onClick={() => handleClick(user?._id)} 
                >
                  Chat
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
