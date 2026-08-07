import React from "react";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useLocation } from "react-router-dom";

import Sidenav from "../../../../Components/SideNavigation/SideNavigation";
import Breadcrumbs from "../../../../Components/Breadcrumbs/Breadcrumbs";
import "../../../../Css/style.css";
import "../../../../Css/table.css";
import "../../../../Css/users.css";
import "../Deposit/Deposit.css";

function DepositListUserWise() {
  const location = useLocation();
  const { data } = location?.state;

  return (
    <>
      <div className="g-sidenav-show  bg-gray-100">
        <ToastContainer autoClose={2000} position="top-center" />
        <Sidenav />
        <main className="main-content position-relative">
          <div style={{ background: "#f8f9fa" }}>
            <Breadcrumbs tab={"Deposit List"} />
            <table className="table table-view w-full border border-gray-200 rounded-lg shadow-md">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left">Mid</th>
                  <th className="px-4 py-2 text-left">Amount</th>
                  <th className="px-4 py-2 text-left">Count</th>
                </tr>
              </thead>
              <thead>
                <td className="thdr"></td>
                <td className="thdr"></td>
                <td className="thdr"></td>
              </thead>
              <tbody>
                {data?.map((item: any, index: number) => {
                  return (
                    <tr
                      key={index}
                      className="border-t hover:bg-gray-50 transition"
                    >
                      <td className="px-4 py-3">{item?.mid}</td>
                      <td className="px-4 py-3">{item?.amount}</td>
                      <td className="px-4 py-3">{item?.count}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </>
  );
}
export default React.memo(DepositListUserWise);
