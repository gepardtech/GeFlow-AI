import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
const AdminBilling = () => {
  const navigate = useNavigate();
  useEffect(() => { navigate("/admin/billing/subscriptions", { replace: true }); }, [navigate]);
  return null;
};
export default AdminBilling;
