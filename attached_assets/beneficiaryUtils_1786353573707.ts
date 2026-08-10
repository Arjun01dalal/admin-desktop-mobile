import { API_Handler } from "../../../../API/API_Handler";
import { API_Endpoint } from "../../../../Configuration/Settings";
import { encryptData } from "../../../../utils/encryptData";

/** Read beneficiary list from withdrawal/transaction `beneficiaryAccounts` key only. */
export const extractBeneficiaryAccounts = (item: Record<string, any> = {}) => {
  const accounts = item?.beneficiaryAccounts;

  if (Array.isArray(accounts)) {
    return accounts.filter(Boolean);
  }

  if (typeof accounts === "string" && accounts.trim()) {
    return [accounts.trim()];
  }

  return [];
};

export const removeAvailableBanks = async (names: string[]) => {
  if (!names.length) {
    throw new Error("At least one bank name is required");
  }

  const token = localStorage.getItem("token");
  const response = await API_Handler.post(
    `${API_Endpoint}/change-percentage/available-banks/update`,
    {
      token: encryptData({
        action: "remove",
        names,
      }),
    },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      maxBodyLength: Infinity,
    },
  );

  return response;
};

export const syncWithdrawalBeneficiaryAccounts = async (transactionId: string) => {
  if (!transactionId) return;

  const token = localStorage.getItem("token");
  await API_Handler.post(
    `${API_Endpoint}/transaction/sync-withdrawal-beneficiary-accounts`,
    { token: encryptData({ transactionId }) },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      maxBodyLength: Infinity,
    },
  );
};
