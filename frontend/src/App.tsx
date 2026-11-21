import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Explore from "./pages/Explore";
import Create3 from "./pages/Create3";
import PTender from "./pages/PTender";
import PBid from "./pages/PBid";
import PEvaluate from "./pages/PEvaluate";
import PVerify from "./pages/PVerify";
import TenderDetails from "./pages/TenderDetails";
import Bid from "./pages/Bid";
import Evaluate from "./pages/Evaluate";
import Security from "./pages/Security";
import Circuit from "./pages/Circuit";
import Verify from "./pages/Verify";
import Dashboard from "./pages/Dashboard";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/tenders" element={<Explore />} />
        <Route path="/create" element={<Create3 />} />
        <Route path="/tender/:id" element={<TenderDetails />} />
        <Route path="/tender/:id/bid" element={<Bid />} />
        <Route path="/tender/:id/evaluate" element={<Evaluate />} />
        <Route path="/security" element={<Security />} />
        <Route path="/circuit" element={<Circuit />} />
        <Route path="/p/tender/:id" element={<PTender />} />
        <Route path="/p/tender/:id/bid" element={<PBid />} />
        <Route path="/p/tender/:id/evaluate" element={<PEvaluate />} />
        <Route path="/p/verify" element={<PVerify />} />
        <Route path="/p/verify/:id" element={<PVerify />} />
        <Route path="/verify" element={<Verify />} />
        <Route path="/verify/:id" element={<Verify />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Route>
    </Routes>
  );
}
