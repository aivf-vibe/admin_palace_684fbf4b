





import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { 
  Users, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  TrendingUp,
  Calendar,
  Building,
  Shield
} from 'lucide-react';
import { visitorService } from '../services/api';
import { useSocket } from '../contexts/SocketContext';
import { format } from 'date-fns';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const Dashboard = () => {
  const [period, setPeriod] = useState('7d');
  const socket = useSocket();

  const { data: analytics, isLoading, refetch } = useQuery(
    ['analytics', period],
    () => visitorService.getDashboardAnalytics(period),
    {
      refetchInterval: 30000, // Refetch every 30 seconds
    }
  );

  useEffect(() => {
    if (socket) {
      socket.on('new-visitor', () => refetch());
      socket.on('approval-status-changed', () => refetch());
      
      return () => {
        socket.off('new-visitor');
        socket.off('approval-status-changed');
      };
    }
  }, [socket, refetch]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const { summary, trends, topHosts, purposeStats } = analytics || {};

  // Chart configurations
  const visitorTrendsData = {
    labels: trends?.map(t => `${t._id.month}/${t._id.day}`) || [],
    datasets: [
      {
        label: 'Total Visitors',
        data: trends?.map(t => t.visitors) || [],
        borderColor: 'rgb(99, 102, 241)',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        tension: 0.4,
      },
      {
        label: 'Checked In',
        data: trends?.map(t => t.checkedIn) || [],
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.4,
      },
    ],
  };

  const purposeData = {
    labels: purposeStats?.map(p => p._id) || [],
    datasets: [
      {
        data: purposeStats?.map(p => p.count) || [],
        backgroundColor: [
          'rgba(99, 102, 241, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(139, 92, 246, 0.8)',
          'rgba(236, 72, 153, 0.8)',
        ],
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  const StatCard = ({ icon: Icon, title, value, change, color }) => (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {change && (
            <p className={`text-sm ${change > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {change > 0 ? '+' : ''}{change}% from last period
            </p>
          )}
        </div>
        <div className={`p-3 rounded-full ${color}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Welcome to AdminPalace Visitor Management</p>
      </div>

      {/* Period Selector */}
      <div className="mb-6">
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="1d">Last 24 Hours</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
          <option value="90d">Last 90 Days</option>
        </select>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon={Users}
          title="Total Visitors"
          value={summary?.visitorStats?.totalVisitors || 0}
          color="bg-blue-500"
        />
        <StatCard
          icon={CheckCircle}
          title="Checked In"
          value={summary?.visitorStats?.checkedIn || 0}
          color="bg-green-500"
        />
        <StatCard
          icon={Clock}
          title="Pending Approvals"
          value={summary?.visitorStats?.pendingApprovals || 0}
          color="bg-yellow-500"
        />
        <StatCard
          icon={AlertCircle}
          title="Avg Visit Duration"
          value={`${Math.round(summary?.visitorStats?.avgVisitDuration || 0)} min`}
          color="bg-purple-500"
        />
      </div>

      {/* Today's Overview */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Today's Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-blue-600">{summary?.todayStats?.scheduled || 0}</p>
            <p className="text-gray-600">Scheduled</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-green-600">{summary?.todayStats?.checkedIn || 0}</p>
            <p className="text-gray-600">Checked In</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-600">{summary?.todayStats?.checkedOut || 0}</p>
            <p className="text-gray-600">Checked Out</p>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Visitor Trends */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Visitor Trends</h3>
          <div className="h-64">
            <Line data={visitorTrendsData} options={chartOptions} />
          </div>
        </div>

        {/* Purpose Distribution */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Visit Purpose Distribution</h3>
          <div className="h-64">
            <Doughnut data={purposeData} options={{ maintainAspectRatio: false }} />
          </div>
        </div>
      </div>

      {/* Top Hosts */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">Top Hosts</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Host
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Department
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Visitors
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unique Visitors
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {topHosts?.map((host, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {host.hostName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {host.hostDepartment || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {host.visitorCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {host.uniqueVisitors}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;






