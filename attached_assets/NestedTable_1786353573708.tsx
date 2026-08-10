import React, { useState, Fragment } from "react";
import UploadIcon from "@mui/icons-material/Upload";

import { API_Endpoint } from "../../../../Configuration/Settings";
import { encryptData } from "../../../../utils/encryptData";
import { decryptData } from "../../../../utils/decryptData";

interface Withdrawal {
  _id: string;
  amount: number;
}

interface Mid {
  mid: string;
  totalAmount: number;
  withdrawals: Withdrawal[];
}

interface Gateway {
  mids: Mid[];
}

interface Props {
  apiData: any[];
  navigate: any;
  handleUploadBtnClicked: any;
  startDate: any;
  endDate: any;
}

const NestedTable: React.FC<Props> = ({
  apiData,
  navigate,
  handleUploadBtnClicked,
  startDate,
  endDate,
}) => {
  const [openTypeIndex, setOpenTypeIndex] = useState<number | null>(null);
  const [openProviderIndex, setOpenProviderIndex] = useState<string | null>(
    null,
  );

  const [aa, setAa] = useState<any[]>([]);
  const [loadingProviders, setLoadingProviders] = useState<any>({});

  const handleAddition = (res1: any) => {
    const res = apiData?.filter((v:any)=>v?.type === res1);
    if (res && Object.keys(res).length > 0) {
      let amount = 0;
      let count = 0;

      Object.values(res).forEach((type: any) => {
        Object.values(type).forEach((bank: any) => {
          Object.values(bank).forEach((item: any) => {
            amount += item.totalAmount || 0;
            count += item.count || 0;
          });
        });
      });
      return amount;
    }
  };

  // 🔹 API
  const fetchMidData = async (mid: string) => {
    const res = await fetch(
      `${API_Endpoint}/withdrawal/latest-withdrawal-report`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Beaer dwewd",
        },
        body: JSON.stringify({
          token: encryptData({
            mid,
            startDate: startDate,
            endDate: endDate,
          }),
        }),
      },
    );

    const encryptedData = await res.json();
    return decryptData(encryptedData?.data);
  };

  // 🔹 unique mids
  const getAllMids = (gatewayNames: Gateway[]): Mid[] => {
    const mids = gatewayNames?.flatMap((g) => g.mids || []) || [];

    return Object.values(
      mids.reduce((acc: any, curr) => {
        acc[curr.mid] = curr;
        return acc;
      }, {}),
    );
  };

  // 🔹 batching helper
  const chunkArray = (arr: any[], size: number) => {
    const res = [];
    for (let i = 0; i < arr.length; i += size) {
      res.push(arr.slice(i, i + size));
    }
    return res;
  };

  // 🔹 fetch with batching + cache
  const getMidWiseData = async (gatewayNames: Gateway[]) => {
    const mids = getAllMids(gatewayNames);

    const chunks = chunkArray(mids, 10);

    let finalData: any[] = [];

    for (const chunk of chunks) {
      const batch = await Promise.all(
        chunk.map(async (m) => {
          // 🔥 CACHE CHECK
          const existing = aa.find((item) => item.mid === m.mid);
          if (existing) return existing;

          const apiData = await fetchMidData(m.mid);

          const matched = Array.isArray(apiData)
            ? apiData.find((item: any) => item.mid === m.mid)
            : apiData;

          return {
            mid: m.mid,
            payload: matched || {},
          };
        }),
      );

      finalData = [...finalData, ...batch];
    }

    // merge with existing cache
    setAa((prev) => {
      const map = new Map(prev.map((i) => [i.mid, i]));
      finalData.forEach((i) => map.set(i.mid, i));
      return Array.from(map.values());
    });
  };

  // 🔹 click handler (LAZY LOAD)
  const handleProviderClick = async (
    providerKey: string,
    gatewayNames: Gateway[],
  ) => {
    const isOpen = openProviderIndex === providerKey;

    setOpenProviderIndex(isOpen ? null : providerKey);

    if (!isOpen) {
      setLoadingProviders((prev: any) => ({ ...prev, [providerKey]: true }));

      await getMidWiseData(gatewayNames);

      setLoadingProviders((prev: any) => ({ ...prev, [providerKey]: false }));
    }
  };

  const getPayload = (mid: string) => {
    return aa.find((item) => item.mid === mid)?.payload;
  };

  return (
    <table className="table table-view">
      <thead>
        <tr>
          <th>#</th>
          <th>Type / Provider / MID</th>
          <th>Total Amount</th>
          <th>Count</th>
          <th>Matched Record</th>
          <th>
            Txn found in system <br /> but not in Acc. Statement
          </th>
          <th>
            Txn found in Acc. Statement <br />
            but not in system
          </th>
          <th>Action</th>
        </tr>
      </thead>

      <tbody>
        {apiData?.map((typeItem, typeIndex) => {
          const isTypeOpen = openTypeIndex === typeIndex;

          return (
            <Fragment key={typeIndex}>
              <tr
                className="cursor-pointer table-primary"
                onClick={() => setOpenTypeIndex(isTypeOpen ? null : typeIndex)}
              >
                <td>{typeIndex + 1}</td>
                <td>
                  <strong>{typeItem.type.toUpperCase()}</strong>{" "}
                  {isTypeOpen ? "▲" : "▼"}
                </td>
                <td>
                  {handleAddition(typeItem.type)}
                </td>
                <td>{typeItem.providers?.length}</td>
                <td colSpan={4}></td>
              </tr>

              {isTypeOpen &&
                typeItem.providers?.map((provider: any, pIndex: number) => {
                  const providerKey = `${typeIndex}-${pIndex}`;
                  const isProviderOpen = openProviderIndex === providerKey;

                  const mids = getAllMids(provider.gatewayNames);

                  return (
                    <Fragment key={providerKey}>
                      <tr
                        className="cursor-pointer"
                        onClick={() =>
                          handleProviderClick(
                            providerKey,
                            provider.gatewayNames,
                          )
                        }
                      >
                        <td></td>
                        <td>
                          {provider.withdrewalProviderName}{" "}
                          {isProviderOpen ? "▲" : "▼"}
                        </td>
                        <td>{provider.totalAmount}</td>
                        <td>{mids.length}</td>
                        <td colSpan={4}>
                          {loadingProviders[providerKey] && "Loading..."}
                        </td>
                      </tr>

                      {isProviderOpen &&
                        mids.map((mid: any, mIndex: number) => {
                          const payload = getPayload(mid.mid);
                          console.log("payload::", payload);

                          return (
                            <tr key={`${providerKey}-${mIndex}`}>
                              <td></td>
                              <td
                                onClick={() =>
                                  navigate("/withdrawUserData", {
                                    state: mid,
                                  })
                                }
                              >
                                {mid.mid}
                              </td>
                              <td>{mid.totalAmount}</td>
                              <td>{mid.withdrawals?.length}</td>
                              <td
                                onClick={() =>
                                  navigate("/withdrawUserData", {
                                    state: {
                                      record: payload?.payload,
                                      type: "filterRecord",
                                      key: "bothInSheetAndDb",
                                    },
                                  })
                                }
                              >
                                {payload?.payload?.summary
                                  ?.bothInSheetAndDbCount || "-"}
                              </td>
                              <td
                                onClick={() =>
                                  navigate("/withdrawUserData", {
                                    state: {
                                      record: payload?.payload,
                                      type: "filterRecord",
                                      key: "dbButNotInSheet",
                                    },
                                  })
                                }
                              >
                                {payload?.payload?.summary
                                  ?.dbButNotInSheetCount || "-"}
                              </td>
                              <td
                                onClick={() =>
                                  navigate("/withdrawUserData", {
                                    state: {
                                      record: payload?.payload,
                                      type: "filterRecord",
                                      key: "sheetButNotInDb",
                                    },
                                  })
                                }
                              >
                                {payload?.payload?.summary
                                  ?.sheetButNotInDbCount || "-"}
                              </td>
                              <td
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUploadBtnClicked(
                                    provider.withdrewalProviderName,
                                    mid.mid,
                                  );
                                }}
                              >
                                <UploadIcon fontSize="small" />
                              </td>
                            </tr>
                          );
                        })}
                    </Fragment>
                  );
                })}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
};

export default NestedTable;
