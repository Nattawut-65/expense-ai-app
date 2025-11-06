"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { checkAdminSession, clearAdminSession } from "@/lib/adminAuth";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, onSnapshot, doc, updateDoc } from "firebase/firestore";

export default function AdminDashboard() {
  const [adminData, setAdminData] = useState(null);
  const [users, setUsers] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [adminRequests, setAdminRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [showAdminList, setShowAdminList] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedRole, setSelectedRole] = useState("");
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [currentAdminRole, setCurrentAdminRole] = useState(null);
  const [showSuggestionsList, setShowSuggestionsList] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const router = useRouter();

  // ✅ ตรวจสอบ admin session
  useEffect(() => {
    const admin = checkAdminSession();
    if (!admin) {
      router.push("/admin");
      return;
    }
    setAdminData(admin);
    loadUsers();
    loadSuggestions();
    loadAdminRequests();
    loadTransactions();
    
    // ✅ Real-time listener สำหรับ users
    const unsubscribeUsers = onSnapshot(collection(db, "users"), () => {
      loadUsers(); // โหลดข้อมูลใหม่เมื่อมีการเปลี่ยนแปลง
    });

    // ✅ Real-time listener สำหรับ suggestions
    const unsubscribeSuggestions = onSnapshot(collection(db, "suggestions"), () => {
      loadSuggestions(); // โหลดข้อมูลใหม่เมื่อมีการเปลี่ยนแปลง
    });

    // ✅ Real-time listener สำหรับ admin requests
    const unsubscribeAdminRequests = onSnapshot(collection(db, "adminRequests"), () => {
      loadAdminRequests(); // โหลดข้อมูลใหม่เมื่อมีการเปลี่ยนแปลง
    });

    return () => {
      unsubscribeUsers();
      unsubscribeSuggestions();
      unsubscribeAdminRequests();
    };
  }, [router]);

  // ✅ โหลดข้อมูล users ทั้งหมด
  const loadUsers = async () => {
    try {
      const usersSnapshot = await getDocs(collection(db, "users"));
      const usersData = [];
      
      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        const userId = userDoc.id;
        
        // นับจำนวน transactions
        const transactionsSnapshot = await getDocs(
          query(collection(db, "transactions"), orderBy("date", "desc"))
        );
        const userTransactions = transactionsSnapshot.docs.filter(
          (doc) => doc.data().userId === userId
        );
        
        usersData.push({
          id: userId,
          email: userData.email || "N/A",
          displayName: userData.name || userData.displayName || "ไม่ระบุชื่อ",
          transactionCount: userTransactions.length,
          createdAt: userData.createdAt || "N/A",
        });
      }
      
      setUsers(usersData);
      setLoading(false);
    } catch (error) {
      console.error("Error loading users:", error);
      setLoading(false);
    }
  };

  // ✅ โหลดข้อเสนอแนะทั้งหมด
  const loadSuggestions = async () => {
    try {
      const suggestionsSnapshot = await getDocs(
        query(collection(db, "suggestions"), orderBy("createdAt", "desc"))
      );
      
      const suggestionsData = suggestionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setSuggestions(suggestionsData);
    } catch (error) {
      console.error("Error loading suggestions:", error);
    }
  };

  // ✅ โหลดคำขอสมัครแอดมินทั้งหมด
  const loadAdminRequests = async () => {
    try {
      const requestsSnapshot = await getDocs(
        query(collection(db, "adminRequests"), orderBy("createdAt", "desc"))
      );
      
      const requestsData = requestsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setAdminRequests(requestsData);
      
      // ✅ ตรวจสอบระดับของแอดมินที่ล็อกอินอยู่
      if (adminData?.email) {
        const currentAdmin = requestsData.find(
          req => req.userEmail === adminData.email && req.status === 'approved'
        );
        setCurrentAdminRole(currentAdmin?.adminRole || null);
      }
    } catch (error) {
      console.error("Error loading admin requests:", error);
    }
  };

  // ✅ โหลด transactions ทั้งหมด
  const loadTransactions = async () => {
    try {
      const transactionsSnapshot = await getDocs(
        query(collection(db, "transactions"), orderBy("date", "desc"))
      );
      
      const transactionsData = transactionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setTransactions(transactionsData);
    } catch (error) {
      console.error("Error loading transactions:", error);
    }
  };

  // ✅ อนุมัติคำขอเป็นแอดมิน
  const handleApproveRequest = async (requestId) => {
    try {
      const requestRef = doc(db, "adminRequests", requestId);
      await updateDoc(requestRef, {
        status: "approved",
        approvedAt: new Date()
      });
      alert("อนุมัติคำขอเรียบร้อย ✅");
      loadAdminRequests();
    } catch (error) {
      console.error("Error approving request:", error);
      alert("เกิดข้อผิดพลาด ❌");
    }
  };

  // ✅ อนุมัติคำขอพร้อมระดับ
  const handleApproveWithRole = async () => {
    if (!selectedRole) {
      alert("กรุณาเลือกระดับแอดมิน");
      return;
    }
    try {
      const requestRef = doc(db, "adminRequests", selectedRequest);
      await updateDoc(requestRef, {
        status: "approved",
        approvedAt: new Date(),
        adminRole: selectedRole
      });
      alert("อนุมัติคำขอเรียบร้อย ✅");
      setSelectedRequest(null);
      setSelectedRole("");
      loadAdminRequests();
    } catch (error) {
      console.error("Error approving request:", error);
      alert("เกิดข้อผิดพลาด ❌");
    }
  };

  // ✅ อัปเดตระดับแอดมิน
  const handleUpdateAdminRole = async () => {
    if (!selectedRole || !editingAdmin) {
      alert("กรุณาเลือกระดับแอดมิน");
      return;
    }
    
    // ตรวจสอบว่าเป็นหัวหน้าแอดมินหรือไม่
    if (currentAdminRole !== 'head') {
      alert("❌ เฉพาะหัวหน้าแอดมินเท่านั้นที่สามารถปรับระดับได้");
      setEditingAdmin(null);
      setSelectedRole("");
      return;
    }
    
    try {
      const requestRef = doc(db, "adminRequests", editingAdmin);
      await updateDoc(requestRef, {
        adminRole: selectedRole,
        updatedAt: new Date()
      });
      alert("อัปเดตระดับเรียบร้อย ✅");
      setEditingAdmin(null);
      setSelectedRole("");
      loadAdminRequests();
    } catch (error) {
      console.error("Error updating admin role:", error);
      alert("เกิดข้อผิดพลาด ❌");
    }
  };

  // ✅ ปฏิเสธคำขอเป็นแอดมิน
  const handleRejectRequest = async (requestId) => {
    try {
      const requestRef = doc(db, "adminRequests", requestId);
      await updateDoc(requestRef, {
        status: "rejected",
        rejectedAt: new Date()
      });
      alert("ปฏิเสธคำขอเรียบร้อย ❌");
      loadAdminRequests();
    } catch (error) {
      console.error("Error rejecting request:", error);
      alert("เกิดข้อผิดพลาด ❌");
    }
  };

  // ✅ Logout
  const handleLogout = () => {
    clearAdminSession();
    router.push("/admin");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-purple-500 to-purple-700">
        <div className="text-white text-xl">กำลังโหลด...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-500 to-purple-700">
      {/* Header */}
      <div className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-2 py-3 flex flex-col sm:flex-row justify-between items-center gap-2 sm:gap-0">
          <div className="flex items-center gap-3">
            <div className="bg-purple-100 p-2 rounded-full">
              <span className="text-2xl">👑</span>
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-xs sm:text-sm text-gray-600">ยินดีต้อนรับ, {adminData?.displayName}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700 transition text-sm sm:text-base"
          >
            ออกจากระบบ
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-2 py-4">
        <div className="flex gap-2 mb-4 overflow-x-auto flex-nowrap">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2 rounded-lg font-medium transition whitespace-nowrap text-xs sm:text-base ${
              activeTab === "overview"
                ? "bg-white text-purple-600 shadow-lg"
                : "bg-purple-400 text-white hover:bg-purple-300"
            }`}
          >
            📊 ภาพรวม
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`px-4 py-2 rounded-lg font-medium transition whitespace-nowrap text-xs sm:text-base ${
              activeTab === "users"
                ? "bg-white text-purple-600 shadow-lg"
                : "bg-purple-400 text-white hover:bg-purple-300"
            }`}
          >
            👥 ผู้ใช้ทั้งหมด
          </button>
          <button
            onClick={() => setActiveTab("analytics")}
            className={`px-4 py-2 rounded-lg font-medium transition whitespace-nowrap text-xs sm:text-base ${
              activeTab === "analytics"
                ? "bg-white text-purple-600 shadow-lg"
                : "bg-purple-400 text-white hover:bg-purple-300"
            }`}
          >
            📈 สถิติและกราฟ
          </button>
          <button
            onClick={() => setActiveTab("adminRequests")}
            className={`px-4 py-2 rounded-lg font-medium transition whitespace-nowrap text-xs sm:text-base ${
              activeTab === "adminRequests"
                ? "bg-white text-purple-600 shadow-lg"
                : "bg-purple-400 text-white hover:bg-purple-300"
            }`}
          >
            👑 คำขอเป็นแอดมิน ({adminRequests.filter(r => r.status === 'pending').length})
          </button>
          <button
            onClick={() => setActiveTab("suggestions")}
            className={`px-4 py-2 rounded-lg font-medium transition whitespace-nowrap text-xs sm:text-base ${
              activeTab === "suggestions"
                ? "bg-white text-purple-600 shadow-lg"
                : "bg-purple-400 text-white hover:bg-purple-300"
            }`}
          >
            💡 ข้อเสนอแนะ ({suggestions.length})
          </button>
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div 
              onClick={() => setShowAdminList(true)}
              className="bg-white rounded-xl shadow-lg p-6 cursor-pointer hover:shadow-xl transition-all hover:scale-105"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">แอดมินทั้งหมด</p>
                  <p className="text-3xl font-bold text-purple-600 mt-2">
                    {adminRequests.filter(r => r.status === 'approved').length}
                  </p>
                </div>
                <div className="bg-gradient-to-r from-purple-100 to-pink-100 p-4 rounded-full">
                  <span className="text-3xl">👑</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">ผู้ใช้ทั้งหมด</p>
                  <p className="text-3xl font-bold text-purple-600 mt-2">
                    {users.filter(user => {
                      const isAdmin = adminRequests.some(
                        req => req.userId === user.id && req.status === 'approved'
                      );
                      return !isAdmin;
                    }).length}
                  </p>
                </div>
                <div className="bg-purple-100 p-4 rounded-full">
                  <span className="text-3xl">👥 </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">รายการทั้งหมด</p>
                  <p className="text-3xl font-bold text-purple-600 mt-2">
                    {users.reduce((sum, user) => sum + user.transactionCount, 0)}
                  </p>
                </div>
                <div className="bg-purple-100 p-4 rounded-full">
                  <span className="text-3xl">📝</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">สถานะระบบ</p>
                  <p className="text-lg font-bold text-green-600 mt-2">✅ ปกติ</p>
                </div>
                <div className="bg-purple-100 p-4 rounded-full">
                  <span className="text-3xl">⚙️</span>
                </div>
              </div>
            </div>
          </div>

          {/* กราฟวิเคราะห์พฤติกรรม */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            {/* กราฟแท่ง - จำนวนผู้ใช้ตามประเภท */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">📊 สถิติผู้ใช้งาน</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600 flex items-center gap-2">
                      <span className="w-3 h-3 bg-green-500 rounded"></span>
                      แอดมิน
                    </span>
                    <span className="font-bold text-green-600">
                      {adminRequests.filter(r => r.status === 'approved').length}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-gradient-to-r from-green-400 to-green-600 h-3 rounded-full transition-all"
                      style={{ 
                        width: `${Math.min(100, (adminRequests.filter(r => r.status === 'approved').length / Math.max(users.length, 1)) * 100)}%` 
                      }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600 flex items-center gap-2">
                      <span className="w-3 h-3 bg-purple-500 rounded"></span>
                      ผู้ใช้ทั่วไป
                    </span>
                    <span className="font-bold text-purple-600">
                      {users.filter(user => {
                        const isAdmin = adminRequests.some(
                          req => req.userId === user.id && req.status === 'approved'
                        );
                        return !isAdmin;
                      }).length}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-gradient-to-r from-purple-400 to-purple-600 h-3 rounded-full transition-all"
                      style={{ 
                        width: `${Math.min(100, (users.filter(user => {
                          const isAdmin = adminRequests.some(
                            req => req.userId === user.id && req.status === 'approved'
                          );
                          return !isAdmin;
                        }).length / Math.max(users.length, 1)) * 100)}%` 
                      }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600 flex items-center gap-2">
                      <span className="w-3 h-3 bg-yellow-500 rounded"></span>
                      คำขอรออนุมัติ
                    </span>
                    <span className="font-bold text-yellow-600">
                      {adminRequests.filter(r => r.status === 'pending').length}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-gradient-to-r from-yellow-400 to-yellow-600 h-3 rounded-full transition-all"
                      style={{ 
                        width: `${Math.min(100, (adminRequests.filter(r => r.status === 'pending').length / Math.max(adminRequests.length, 1)) * 100)}%` 
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {/* การกระจายตัวของแอดมิน */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">👑 การกระจายตัวของแอดมิน</h3>
              <div className="space-y-4">
                {(() => {
                  const headCount = adminRequests.filter(r => r.status === 'approved' && r.adminRole === 'head').length;
                  const assistantCount = adminRequests.filter(r => r.status === 'approved' && r.adminRole === 'assistant').length;
                  const moderatorCount = adminRequests.filter(r => r.status === 'approved' && r.adminRole === 'moderator').length;
                  const totalApproved = adminRequests.filter(r => r.status === 'approved').length;

                  return (
                    <>
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm text-gray-600">👑 หัวหน้าแอดมิน</span>
                          <span className="font-bold text-purple-600">{headCount}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div 
                            className="bg-gradient-to-r from-purple-400 to-purple-600 h-3 rounded-full transition-all"
                            style={{ width: `${totalApproved > 0 ? (headCount / totalApproved) * 100 : 0}%` }}
                          ></div>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm text-gray-600">🤝 ผู้ช่วย</span>
                          <span className="font-bold text-blue-600">{assistantCount}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div 
                            className="bg-gradient-to-r from-blue-400 to-blue-600 h-3 rounded-full transition-all"
                            style={{ width: `${totalApproved > 0 ? (assistantCount / totalApproved) * 100 : 0}%` }}
                          ></div>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm text-gray-600">⚙️ ผู้ดูแลระบบ</span>
                          <span className="font-bold text-indigo-600">{moderatorCount}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div 
                            className="bg-gradient-to-r from-indigo-400 to-indigo-600 h-3 rounded-full transition-all"
                            style={{ width: `${totalApproved > 0 ? (moderatorCount / totalApproved) * 100 : 0}%` }}
                          ></div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* พฤติกรรมการใช้งาน */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">📈 พฤติกรรมการใช้งาน</h3>
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4 border-2 border-purple-200">
                  <p className="text-sm text-gray-600 mb-1">ค่าเฉลี่ยรายการต่อผู้ใช้</p>
                  <p className="text-3xl font-bold text-purple-600">
                    {users.length > 0 
                      ? (users.reduce((sum, user) => sum + user.transactionCount, 0) / users.length).toFixed(1)
                      : 0
                    }
                  </p>
                  <p className="text-xs text-gray-500 mt-1">รายการ/คน</p>
                </div>

                <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border-2 border-green-200">
                  <p className="text-sm text-gray-600 mb-1">ผู้ใช้ที่มีกิจกรรมสูงสุด</p>
                  <p className="text-xl font-bold text-green-600">
                    {users.length > 0
                      ? Math.max(...users.map(u => u.transactionCount || 0))
                      : 0
                    }
                  </p>
                  <p className="text-xs text-gray-500 mt-1">รายการ</p>
                </div>

                <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-4 border-2 border-blue-200">
                  <p className="text-sm text-gray-600 mb-1">ผู้ใช้งานใหม่</p>
                  <p className="text-xl font-bold text-blue-600">
                    {users.filter(user => {
                      if (!user.createdAt?.toDate) return false;
                      const created = user.createdAt.toDate();
                      const now = new Date();
                      const diffDays = (now - created) / (1000 * 60 * 60 * 24);
                      return diffDays <= 7;
                    }).length}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">ใน 7 วันที่ผ่านมา</p>
                </div>
              </div>
            </div>

            {/* สถิติข้อเสนอแนะ */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">💡 สถิติข้อเสนอแนะ</h3>
              <div className="space-y-4">
                <div 
                  onClick={() => setShowSuggestionsList(true)}
                  className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4 border-2 border-purple-200 cursor-pointer hover:shadow-lg transition-all hover:scale-105"
                >
                  <p className="text-sm text-gray-600 mb-1">ข้อเสนอแนะทั้งหมด</p>
                  <p className="text-3xl font-bold text-purple-600">{suggestions.length}</p>
                  <p className="text-xs text-gray-500 mt-1">คลิกเพื่อดูรายละเอียด</p>
                </div>

                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg p-4 border-2 border-yellow-200">
                  <p className="text-sm text-gray-600 mb-1">รอดำเนินการ</p>
                  <p className="text-3xl font-bold text-yellow-600">
                    {suggestions.filter(s => s.status === 'pending' || !s.status).length}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">ข้อความ</p>
                </div>

                <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border-2 border-green-200">
                  <p className="text-sm text-gray-600 mb-1">อัตราส่วนข้อเสนอแนะ</p>
                  <p className="text-xl font-bold text-green-600">
                    {users.length > 0 
                      ? ((suggestions.length / users.length) * 100).toFixed(1)
                      : 0
                    }%
                  </p>
                  <p className="text-xs text-gray-500 mt-1">ของผู้ใช้ทั้งหมด</p>
                </div>
              </div>
            </div>
          </div>
          </>
        )}

        {/* Users Tab */}
        {activeTab === "users" && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-xs sm:text-sm">
                <thead className="bg-purple-600 text-white">
                  <tr>
                    <th className="px-3 py-2 sm:px-6 sm:py-4 text-left font-semibold">ลำดับ</th>
                    <th className="px-3 py-2 sm:px-6 sm:py-4 text-left font-semibold">อีเมล</th>
                    <th className="px-3 py-2 sm:px-6 sm:py-4 text-left font-semibold">ชื่อผู้ใช้</th>
                    <th className="px-3 py-2 sm:px-6 sm:py-4 text-center font-semibold">จำนวนรายการ</th>
                    <th className="px-3 py-2 sm:px-6 sm:py-4 text-left font-semibold">สร้างเมื่อ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {users
                    .filter(user => {
                      // กรองเอาเฉพาะผู้ใช้ที่ไม่ใช่แอดมิน
                      const isAdmin = adminRequests.some(
                        req => req.userId === user.id && req.status === 'approved'
                      );
                      return !isAdmin;
                    })
                    .map((user, index) => (
                      <tr key={user.id} className="hover:bg-purple-50 transition">
                        <td className="px-3 py-2 sm:px-6 sm:py-4 text-gray-900">{index + 1}</td>
                        <td className="px-3 py-2 sm:px-6 sm:py-4 text-gray-900">{user.email}</td>
                        <td className="px-3 py-2 sm:px-6 sm:py-4 text-gray-900">
                          {user.displayName}
                        </td>
                        <td className="px-3 py-2 sm:px-6 sm:py-4 text-center">
                          <span className="bg-purple-100 text-purple-800 px-2 py-1 sm:px-3 sm:py-1 rounded-full text-xs sm:text-sm font-medium">
                            {user.transactionCount}
                          </span>
                        </td>
                        <td className="px-3 py-2 sm:px-6 sm:py-4 text-gray-600">
                          {typeof user.createdAt === 'object' && user.createdAt?.toDate
                            ? user.createdAt.toDate().toLocaleDateString('th-TH')
                            : user.createdAt}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {users.filter(user => {
                const isAdmin = adminRequests.some(
                  req => req.userId === user.id && req.status === 'approved'
                );
                return !isAdmin;
              }).length === 0 && (
                <div className="text-center py-12 text-gray-500 text-xs sm:text-base">
                  ไม่มีข้อมูลผู้ใช้
                </div>
              )}
            </div>
          </div>
        )}

        {/* Suggestions Tab */}
        {activeTab === "suggestions" && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="bg-purple-600 px-6 py-4">
              <h2 className="text-white font-bold text-lg">📬 กล่องข้อเสนอแนะ</h2>
              <p className="text-purple-100 text-sm">ข้อเสนอแนะจากผู้ใช้ทั้งหมด</p>
            </div>
            
            {suggestions.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                ยังไม่มีข้อเสนอแนะ
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {suggestions.map((suggestion, index) => (
                  <div key={suggestion.id} className="p-6 hover:bg-purple-50 transition">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="bg-purple-100 text-purple-600 rounded-full w-10 h-10 flex items-center justify-center font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">
                            {suggestion.userName || "ไม่ระบุชื่อ"}
                          </p>
                          <p className="text-sm text-gray-500">{suggestion.userEmail}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">
                          {suggestion.createdAt?.toDate
                            ? suggestion.createdAt.toDate().toLocaleString('th-TH', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : 'N/A'}
                        </p>
                        <span className={`inline-block mt-1 px-2 py-1 rounded-full text-xs font-medium ${
                          suggestion.status === 'new' 
                            ? 'bg-green-100 text-green-800' 
                            : suggestion.status === 'read'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {suggestion.status === 'new' ? '🆕 ใหม่' : 
                           suggestion.status === 'read' ? '👀 อ่านแล้ว' : '✅ ดำเนินการแล้ว'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 rounded-lg p-4 ml-13">
                      <p className="text-gray-800 whitespace-pre-wrap">{suggestion.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Admin Requests Tab */}
        {activeTab === "adminRequests" && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4">
              <h2 className="text-white font-bold text-lg">👑 กล่องจดหมายคำขอสมัครแอดมิน</h2>
              <p className="text-purple-100 text-sm">จัดการคำขอสมัครเป็นแอดมินจากผู้ใช้</p>
            </div>
            
            {adminRequests.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                ยังไม่มีคำขอสมัครเป็นแอดมิน
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {adminRequests.map((request, index) => (
                  <div key={request.id} className={`p-6 ${
                    request.status === 'pending' ? 'bg-yellow-50' : 'bg-white'
                  }`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`rounded-full w-12 h-12 flex items-center justify-center font-bold text-white ${
                          request.status === 'pending' ? 'bg-yellow-500' :
                          request.status === 'approved' ? 'bg-green-500' : 'bg-red-500'
                        }`}>
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 text-lg">
                            {request.userName || "ไม่ระบุชื่อ"}
                          </p>
                          <p className="text-sm text-gray-600">{request.userEmail}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500 mb-2">
                          {request.createdAt?.toDate
                            ? request.createdAt.toDate().toLocaleString('th-TH', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : 'N/A'}
                        </p>
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                          request.status === 'pending' ? 'bg-yellow-200 text-yellow-800' :
                          request.status === 'approved' ? 'bg-green-200 text-green-800' :
                          'bg-red-200 text-red-800'
                        }`}>
                          {request.status === 'pending' ? '⏳ รอการอนุมัติ' :
                           request.status === 'approved' ? '✅ อนุมัติแล้ว' : '❌ ปฏิเสธแล้ว'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="bg-white border-2 border-purple-200 rounded-lg p-4 mb-3">
                      <p className="text-xs text-purple-600 font-semibold mb-1">📝 เหตุผล:</p>
                      <p className="text-gray-800 whitespace-pre-wrap">{request.reason}</p>
                    </div>

                    {request.status === 'approved' && request.adminRole && (
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-purple-600 font-semibold">ระดับ:</span>
                        <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium">
                          {request.adminRole === 'head' && '👑 หัวหน้าแอดมิน'}
                          {request.adminRole === 'assistant' && '🤝 ผู้ช่วย'}
                          {request.adminRole === 'moderator' && '⚙️ ผู้ดูแลระบบ'}
                        </span>
                      </div>
                    )}

                    {request.status === 'pending' && (
                      <div className="flex gap-3 justify-end">
                        <button
                          onClick={() => handleRejectRequest(request.id)}
                          className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg font-medium transition flex items-center gap-2"
                        >
                          <span>❌</span>
                          <span>ปฏิเสธ</span>
                        </button>
                        <button
                          onClick={() => {
                            setSelectedRequest(request.id);
                            setSelectedRole("");
                          }}
                          className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg font-medium transition flex items-center gap-2"
                        >
                          <span>✅</span>
                          <span>อนุมัติ</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Analytics Tab - สถิติและกราฟ */}
        {activeTab === "analytics" && (
          <div className="space-y-6">
            {/* สรุปหมวดหมู่แต่ละปี */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <span>📊</span>
                <span>หมวดหมู่ที่ผู้ใช้บันทึกมากที่สุด</span>
              </h3>
              <div className="space-y-3">
                {(() => {
                  const categoryCount = {};
                  const categoryEmoji = {
                    'อาหาร/เครื่องดื่ม': '🍜',
                    'บันเทิง': '🎬',
                    'การศึกษา': '📚',
                    'ค่าที่อยู่อาศัย/เครื่องใช้': '🏠',
                    'ยานพาหนะ/การเดินทาง': '🚗',
                    'การสื่อสาร': '📱',
                    'เสื้อผ้า/รองเท้า': '👕',
                    'เวชภัณฑ์/ค่ารักษา': '💊',
                    'อื่นๆ': '📦'
                  };
                  
                  // นับจำนวนครั้งทั้งหมดของแต่ละหมวดหมู่
                  transactions.forEach(t => {
                    if (t.category) {
                      categoryCount[t.category] = (categoryCount[t.category] || 0) + 1;
                    }
                  });
                  
                  const totalCount = Object.values(categoryCount).reduce((sum, count) => sum + count, 0);
                  const sortedCategories = Object.entries(categoryCount)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10);
                  
                  const maxCount = sortedCategories[0]?.[1] || 1;
                  
                  return sortedCategories.length > 0 ? sortedCategories.map(([category, count], index) => {
                    const percentage = ((count / totalCount) * 100).toFixed(1);
                    return (
                      <div key={category}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                            <span>{categoryEmoji[category] || '📦'}</span>
                            <span>{category}</span>
                            <span className="text-xs text-gray-500">#{index + 1}</span>
                          </span>
                          <span className="text-sm font-bold text-purple-600">{count} ครั้ง ({percentage}%)</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-4">
                          <div 
                            className="bg-gradient-to-r from-blue-500 to-cyan-500 h-4 rounded-full transition-all flex items-center justify-end pr-2"
                            style={{ width: `${(count / maxCount) * 100}%` }}
                          >
                            <span className="text-xs text-white font-bold">{count}</span>
                          </div>
                        </div>
                      </div>
                    );
                  }) : (
                    <p className="text-center text-gray-500 py-8">ยังไม่มีข้อมูลรายการ</p>
                  );
                })()}
              </div>
            </div>

            {/* สรุปหมวดหมู่แต่ละปี */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <span>📆</span>
                <span>สรุปรายจ่ายยอดนิยมแต่ละปี</span>
              </h3>
              <div className="space-y-6">
                {(() => {
                  const yearlyCategories = {};
                  
                  transactions.forEach(t => {
                    if (t.date?.toDate && t.category) {
                      const year = t.date.toDate().getFullYear();
                      const amount = parseFloat(t.amount) || 0;
                      if (!yearlyCategories[year]) {
                        yearlyCategories[year] = {};
                      }
                      yearlyCategories[year][t.category] = (yearlyCategories[year][t.category] || 0) + amount;
                    }
                  });
                  
                  const sortedYears = Object.keys(yearlyCategories).sort((a, b) => b - a);
                  
                  return sortedYears.length > 0 ? sortedYears.map(year => {
                    const categories = yearlyCategories[year];
                    const sortedCategories = Object.entries(categories).sort((a, b) => b[1] - a[1]);
                    const topCategory = sortedCategories[0];
                    const totalAmount = Object.values(categories).reduce((sum, amount) => sum + amount, 0);
                    const totalTransactions = transactions.filter(t => 
                      t.date?.toDate && t.date.toDate().getFullYear() === parseInt(year)
                    ).length;
                    
                    const categoryEmoji = {
                      'อาหาร/เครื่องดื่ม': '🍜',
                      'บันเทิง': '🎬',
                      'การศึกษา': '📚',
                      'ค่าที่อยู่อาศัย/เครื่องใช้': '🏠',
                      'ยานพาหนะ/การเดินทาง': '🚗',
                      'การสื่อสาร': '📱',
                      'เสื้อผ้า/รองเท้า': '👕',
                      'เวชภัณฑ์/ค่ารักษา': '💊',
                      'อื่นๆ': '📦'
                    };
                    
                    return (
                      <div key={year} className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 border-2 border-purple-200">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-2xl font-bold text-purple-900">ปี {year}</h4>
                          <span className="bg-purple-500 text-white px-4 py-2 rounded-full text-sm font-bold">
                            {totalTransactions} รายการ
                          </span>
                        </div>
                        
                        <div className="bg-white rounded-lg p-4 mb-4">
                          <p className="text-sm text-gray-600 mb-2">🏆 หมวดหมู่ยอดนิยม</p>
                          <div className="flex items-center gap-3">
                            <span className="text-4xl">{categoryEmoji[topCategory[0]] || '📦'}</span>
                            <div>
                              <p className="text-xl font-bold text-purple-600">{topCategory[0]}</p>
                              <p className="text-sm text-gray-600">
                                ฿{topCategory[1].toLocaleString()} ({((topCategory[1] / totalAmount) * 100).toFixed(1)}%)
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-3 mb-4">
                          {sortedCategories.slice(0, 9).map(([cat, amount]) => {
                            const percentage = ((amount / totalAmount) * 100).toFixed(1);
                            return (
                              <div key={cat} className="bg-white rounded-lg p-3">
                                <p className="text-xs text-gray-600 mb-1 flex items-center gap-1">
                                  <span>{categoryEmoji[cat] || '📦'}</span>
                                  <span className="truncate">{cat}</span>
                                </p>
                                <p className="text-lg font-bold text-purple-600">฿{amount.toLocaleString()}</p>
                                <p className="text-xs text-gray-500">{percentage}%</p>
                                <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                                  <div 
                                    className="bg-gradient-to-r from-purple-400 to-pink-400 h-2 rounded-full"
                                    style={{ width: `${percentage}%` }}
                                  ></div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* สรุปรายจ่ายรายเดือน */}
                        <div className="bg-white rounded-lg p-4 mb-4">
                          <h5 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                            <span>📅</span>
                            <span>สรุปรายจ่ายแต่ละเดือน</span>
                          </h5>
                          {(() => {
                            const monthlyExpenses = {};
                            const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
                            
                            // คำนวณรายจ่ายแต่ละเดือน
                            transactions.forEach(t => {
                              if (t.date?.toDate && t.date.toDate().getFullYear() === parseInt(year)) {
                                const month = t.date.toDate().getMonth();
                                const amount = parseFloat(t.amount) || 0;
                                monthlyExpenses[month] = (monthlyExpenses[month] || 0) + amount;
                              }
                            });
                            
                            const monthlyData = Object.entries(monthlyExpenses).map(([month, amount]) => ({
                              month: parseInt(month),
                              monthName: monthNames[parseInt(month)],
                              amount: amount
                            })).sort((a, b) => a.month - b.month);
                            
                            const maxExpenseMonth = monthlyData.reduce((max, curr) => curr.amount > max.amount ? curr : max, monthlyData[0] || { amount: 0 });
                            
                            return (
                           <div className="grid grid-cols-3 gap-3 mb-4 items-stretch text-center">
  {/* 🔹 ซ้าย: เดือนที่ใช้มากที่สุด */}
  <div className="flex flex-col justify-between bg-gradient-to-r from-red-50 to-orange-50 rounded-lg p-2 sm:p-3 border-2 border-red-200 h-full">
    <p className="text-[10px] sm:text-xs text-gray-600 mb-1 leading-tight">
      🔥 เดือนที่ใช้มากที่สุด
    </p>
    <p className="text-base sm:text-lg md:text-xl font-bold text-red-600 leading-tight">
      {maxExpenseMonth.monthName}
    </p>
    <p className="text-xs sm:text-sm text-gray-700 leading-tight">
      ฿{maxExpenseMonth.amount.toLocaleString()}
    </p>
  </div>

  {/* 🔹 กลาง: รายจ่ายเดือนนี้ */}
  <div className="flex flex-col justify-between bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-2 sm:p-3 border-2 border-purple-200 h-full">
    <p className="text-[10px] sm:text-xs text-gray-600 mb-1 leading-tight">
      💰 รายจ่ายเดือนนี้
    </p>
    <p className="text-base sm:text-lg md:text-xl font-bold text-purple-600 leading-tight">
      ฿{(() => {
        const now = new Date();
        const thisMonth = now.getMonth();
        const thisYear = now.getFullYear();
        const thisMonthAmount = transactions.filter(t =>
          t.date?.toDate &&
          t.date.toDate().getFullYear() === thisYear &&
          t.date.toDate().getMonth() === thisMonth
        ).reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
        return thisMonthAmount.toLocaleString();
      })()}
    </p>
  </div>

  {/* 🔹 ขวา: รายจ่ายรวมทั้งปี */}
  <div className="flex flex-col justify-between bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-2 sm:p-3 border-2 border-blue-200 h-full">
    <p className="text-[10px] sm:text-xs text-gray-600 mb-1 leading-tight">
      💰 รายจ่ายรวมทั้งปี {year}
    </p>
    <p className="text-base sm:text-lg md:text-xl font-bold text-blue-600 leading-tight">
      ฿{totalAmount.toLocaleString()}
    </p>
  </div>
</div>

                            );
                          })()}
                        </div>
                      </div>
                    );
                  }) : (
                    <p className="text-center text-gray-500 py-8">ยังไม่มีข้อมูลรายการ</p>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal แสดงรายชื่อแอดมิน */}
      {showAdminList && (
        <div 
          className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowAdminList(false)}
        >
          <div 
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">👑</span>
                  <h2 className="text-2xl font-bold">รายชื่อแอดมินทั้งหมด</h2>
                </div>
                <button
                  onClick={() => setShowAdminList(false)}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
              {adminRequests.filter(r => r.status === 'approved').length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <span className="text-6xl mb-4 block">👑</span>
                  <p className="text-lg">ยังไม่มีแอดมินในระบบ</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {adminRequests
                    .filter(r => r.status === 'approved')
                    .map((admin, index) => {
                      const user = users.find(u => u.id === admin.userId);
                      const isCurrentAdmin = admin.userEmail === adminData?.email;
                      const canEdit = currentAdminRole === 'head' && !isCurrentAdmin;
                      
                      return (
                        <div 
                          key={admin.id}
                          className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border-2 border-purple-200 hover:shadow-lg transition"
                        >
                          <div className="flex items-center gap-4">
                            <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg">
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xl">👑</span>
                                <h3 className="font-bold text-lg text-purple-900">
                                  {admin.userName || user?.displayName || 'ไม่ระบุชื่อ'}
                                  {isCurrentAdmin && <span className="text-sm text-purple-600 ml-2">(คุณ)</span>}
                                </h3>
                              </div>
                              <p className="text-gray-600 text-sm mb-2">{admin.userEmail}</p>
                              {admin.adminRole && (
                                <div className="mb-2 flex items-center gap-2">
                                  <span className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                                    {admin.adminRole === 'head' && '👑 หัวหน้าแอดมิน'}
                                    {admin.adminRole === 'assistant' && '🤝 ผู้ช่วย'}
                                    {admin.adminRole === 'moderator' && '⚙️ ผู้ดูแลระบบ'}
                                  </span>
                                  {canEdit && (
                                    <button
                                      onClick={() => {
                                        setEditingAdmin(admin.id);
                                        setSelectedRole(admin.adminRole || "");
                                      }}
                                      className="text-purple-600 hover:text-purple-800 text-sm underline"
                                    >
                                      เปลี่ยนระดับ
                                    </button>
                                  )}
                                </div>
                              )}
                              {!admin.adminRole && canEdit && (
                                <button
                                  onClick={() => {
                                    setEditingAdmin(admin.id);
                                    setSelectedRole("");
                                  }}
                                  className="mb-2 bg-purple-500 hover:bg-purple-600 text-white px-3 py-1 rounded-full text-sm font-medium transition"
                                >
                                  + กำหนดระดับ
                                </button>
                              )}
                              {user && (
                                <div className="flex gap-4 mt-2 text-sm text-gray-500">
                                  <span>📝 {user.transactionCount || 0} รายการ</span>
                                  <span>📅 สมัครเมื่อ {typeof user.createdAt === 'object' && user.createdAt?.toDate
                                    ? user.createdAt.toDate().toLocaleDateString('th-TH')
                                    : user.createdAt}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal แสดงรายการข้อเสนอแนะ */}
      {showSuggestionsList && (
        <div 
          className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowSuggestionsList(false)}
        >
          <div 
            className="bg-white rounded-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">💡</span>
                  <h2 className="text-2xl font-bold">ข้อเสนอแนะทั้งหมด</h2>
                  <span className="bg-white bg-opacity-20 px-3 py-1 rounded-full text-sm">
                    {suggestions.length} รายการ
                  </span>
                </div>
                <button
                  onClick={() => setShowSuggestionsList(false)}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
              {suggestions.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <span className="text-6xl mb-4 block">💡</span>
                  <p className="text-lg">ยังไม่มีข้อเสนอแนะ</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {suggestions.map((suggestion, index) => {
                    const user = users.find(u => u.id === suggestion.userId);
                    return (
                      <div 
                        key={suggestion.id}
                        className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border-2 border-purple-200 hover:shadow-lg transition"
                      >
                        <div className="flex items-start gap-4">
                          <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white w-10 h-10 rounded-full flex items-center justify-center font-bold flex-shrink-0">
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <h3 className="font-bold text-lg text-purple-900">
                                  {suggestion.userName || user?.displayName || 'ไม่ระบุชื่อ'}
                                </h3>
                                <p className="text-gray-600 text-sm">{suggestion.userEmail}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-gray-500">
                                  {suggestion.createdAt?.toDate
                                    ? suggestion.createdAt.toDate().toLocaleString('th-TH', {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })
                                    : 'N/A'}
                                </p>
                                <span className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-bold ${
                                  suggestion.status === 'read' 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {suggestion.status === 'read' ? '✅ อ่านแล้ว' : '📋 ใหม่'}
                                </span>
                              </div>
                            </div>
                            
                            <div className="bg-white rounded-lg p-4 border border-purple-200">
                              <p className="text-gray-800 whitespace-pre-wrap">{suggestion.message}</p>
                            </div>

                            {suggestion.status !== 'read' && (
                              <button
                                onClick={async () => {
                                  try {
                                    await updateDoc(doc(db, "suggestions", suggestion.id), {
                                      status: "read",
                                      readAt: new Date()
                                    });
                                    // Reload suggestions
                                    const suggestionsSnapshot = await getDocs(
                                      query(collection(db, "suggestions"), orderBy("createdAt", "desc"))
                                    );
                                    const suggestionsData = suggestionsSnapshot.docs.map(doc => ({
                                      id: doc.id,
                                      ...doc.data()
                                    }));
                                    setSuggestions(suggestionsData);
                                  } catch (error) {
                                    console.error("Error marking as read:", error);
                                  }
                                }}
                                className="mt-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                              >
                                ✅ ทำเครื่องหมายว่าอ่านแล้ว
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal เลือกระดับแอดมิน */}
      {selectedRequest && (
        <div 
          className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => {
            setSelectedRequest(null);
            setSelectedRole("");
          }}
        >
          <div 
            className="bg-white rounded-2xl max-w-md w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-white">
              <h2 className="text-2xl font-bold">เลือกระดับแอดมิน</h2>
              <p className="text-purple-100 text-sm mt-1">กรุณาเลือกระดับก่อนอนุมัติ</p>
            </div>
            
            <div className="p-6 space-y-3">
              <button
                onClick={() => setSelectedRole("head")}
                className={`w-full p-4 rounded-xl border-2 transition text-left ${
                  selectedRole === "head"
                    ? "border-purple-500 bg-purple-50"
                    : "border-gray-200 hover:border-purple-300"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">👑</span>
                  <div>
                    <p className="font-bold text-gray-900">หัวหน้าแอดมิน</p>
                    <p className="text-sm text-gray-600">สิทธิ์สูงสุด ควบคุมทุกอย่าง</p>
                  </div>
                  {selectedRole === "head" && (
                    <span className="ml-auto text-purple-600">✓</span>
                  )}
                </div>
              </button>

              <button
                onClick={() => setSelectedRole("assistant")}
                className={`w-full p-4 rounded-xl border-2 transition text-left ${
                  selectedRole === "assistant"
                    ? "border-purple-500 bg-purple-50"
                    : "border-gray-200 hover:border-purple-300"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🤝</span>
                  <div>
                    <p className="font-bold text-gray-900">ผู้ช่วย</p>
                    <p className="text-sm text-gray-600">ช่วยดูแลและสนับสนุน</p>
                  </div>
                  {selectedRole === "assistant" && (
                    <span className="ml-auto text-purple-600">✓</span>
                  )}
                </div>
              </button>

              <button
                onClick={() => setSelectedRole("moderator")}
                className={`w-full p-4 rounded-xl border-2 transition text-left ${
                  selectedRole === "moderator"
                    ? "border-purple-500 bg-purple-50"
                    : "border-gray-200 hover:border-purple-300"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">⚙️</span>
                  <div>
                    <p className="font-bold text-gray-900">ผู้ดูแลระบบ</p>
                    <p className="text-sm text-gray-600">ดูแลการทำงานของระบบ</p>
                  </div>
                  {selectedRole === "moderator" && (
                    <span className="ml-auto text-purple-600">✓</span>
                  )}
                </div>
              </button>
            </div>

            <div className="p-6 pt-0 flex gap-3">
              <button
                onClick={() => {
                  setSelectedRequest(null);
                  setSelectedRole("");
                }}
                className="flex-1 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleApproveWithRole}
                disabled={!selectedRole}
                className={`flex-1 px-6 py-3 rounded-lg font-medium transition ${
                  selectedRole
                    ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
              >
                ✅ ยืนยันอนุมัติ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal แก้ไขระดับแอดมิน */}
      {editingAdmin && (
        <div 
          className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => {
            setEditingAdmin(null);
            setSelectedRole("");
          }}
        >
          <div 
            className="bg-white rounded-2xl max-w-md w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-white">
              <h2 className="text-2xl font-bold">เปลี่ยนระดับแอดมิน</h2>
              <p className="text-purple-100 text-sm mt-1">เลือกระดับใหม่สำหรับแอดมินคนนี้</p>
            </div>
            
            <div className="p-6 space-y-3">
              <button
                onClick={() => setSelectedRole("head")}
                className={`w-full p-4 rounded-xl border-2 transition text-left ${
                  selectedRole === "head"
                    ? "border-purple-500 bg-purple-50"
                    : "border-gray-200 hover:border-purple-300"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">👑</span>
                  <div>
                    <p className="font-bold text-gray-900">หัวหน้าแอดมิน</p>
                    <p className="text-sm text-gray-600">สิทธิ์สูงสุด ควบคุมทุกอย่าง</p>
                  </div>
                  {selectedRole === "head" && (
                    <span className="ml-auto text-purple-600">✓</span>
                  )}
                </div>
              </button>

              <button
                onClick={() => setSelectedRole("assistant")}
                className={`w-full p-4 rounded-xl border-2 transition text-left ${
                  selectedRole === "assistant"
                    ? "border-purple-500 bg-purple-50"
                    : "border-gray-200 hover:border-purple-300"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🤝</span>
                  <div>
                    <p className="font-bold text-gray-900">ผู้ช่วย</p>
                    <p className="text-sm text-gray-600">ช่วยดูแลและสนับสนุน</p>
                  </div>
                  {selectedRole === "assistant" && (
                    <span className="ml-auto text-purple-600">✓</span>
                  )}
                </div>
              </button>

              <button
                onClick={() => setSelectedRole("moderator")}
                className={`w-full p-4 rounded-xl border-2 transition text-left ${
                  selectedRole === "moderator"
                    ? "border-purple-500 bg-purple-50"
                    : "border-gray-200 hover:border-purple-300"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">⚙️</span>
                  <div>
                    <p className="font-bold text-gray-900">ผู้ดูแลระบบ</p>
                    <p className="text-sm text-gray-600">ดูแลการทำงานของระบบ</p>
                  </div>
                  {selectedRole === "moderator" && (
                    <span className="ml-auto text-purple-600">✓</span>
                  )}
                </div>
              </button>
            </div>

            <div className="p-6 pt-0 flex gap-3">
              <button
                onClick={() => {
                  setEditingAdmin(null);
                  setSelectedRole("");
                }}
                className="flex-1 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleUpdateAdminRole}
                disabled={!selectedRole}
                className={`flex-1 px-6 py-3 rounded-lg font-medium transition ${
                  selectedRole
                    ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
              >
                ✅ บันทึกการเปลี่ยนแปลง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}