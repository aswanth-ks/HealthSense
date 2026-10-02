import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout.jsx';
import ProtectedRoute from './components/auth/ProtectedRoute.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import LiveMonitoring from './pages/LiveMonitoring.jsx';
import HealthTrends from './pages/HealthTrends.jsx';
import History from './pages/History.jsx';
import AIInsights from './pages/AIInsights.jsx';
import Alerts from './pages/Alerts.jsx';
import MyWatch from './pages/MyWatch.jsx';
import Settings from './pages/Settings.jsx';
import Timeline from './pages/Timeline.jsx';
import Profile from './pages/Profile.jsx';
import Demo from './pages/Demo.jsx';
import CycleHealth from './pages/CycleHealth.jsx';
import ThreeDayAssessment from './pages/ThreeDayAssessment.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/live" element={<LiveMonitoring />} />
          <Route path="/trends" element={<HealthTrends />} />
          <Route path="/history" element={<History />} />
          <Route path="/insights" element={<AIInsights />} />
          <Route path="/insights/3-day-assessment" element={<ThreeDayAssessment />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/watch" element={<MyWatch />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/demo" element={<Demo />} />
          <Route path="/cycle" element={<CycleHealth />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
