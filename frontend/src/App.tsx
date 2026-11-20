import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Explore from "./pages/Explore";
import Create from "./pages/Create";
import TenderDetails from "./pages/TenderDetails";
import Bid from "./pages/Bid";
import Evaluate from "./pages/Evaluate";
import Security from "./pages/Security";
import Verify from "./pages/Verify";
import Dashboard from "./pages/Dashboard";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/tenders" element={<Explore />} />
        <Route path="/create" element={<Create />} />
        <Route path="/tender/:id" element={<TenderDetails />} />
        <Route path="/tender/:id/bid" element={<Bid />} />
        <Route path="/tender/:id/evaluate" element={<Evaluate />} />
        <Route path="/security" element={<Security />} />
        <Route path="/verify" element={<Verify />} />
        <Route path="/verify/:id" element={<Verify />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Route>
    </Routes>
  );
}
