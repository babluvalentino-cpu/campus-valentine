import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Landing } from "./pages/Landing";
import { Signup } from "./pages/Signup";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Admin } from "./pages/Admin";
import { ProfileSetup } from "./pages/ProfileSetup";
import { Chat } from "./pages/Chat";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/profile-setup" element={<ProfileSetup />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/chat/:matchId" element={<Chat />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;