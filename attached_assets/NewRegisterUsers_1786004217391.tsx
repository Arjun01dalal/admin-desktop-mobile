import React, {
  ChangeEvent,
  FormEvent,
  useContext,
  useEffect,
  useState,
} from "react";

import { useLocation } from "react-router-dom";

import "./NewRegisterUsers.css";
import Sidenav from "../../../../Components/SideNavigation/SideNavigation";
import Breadcrumbs from "../../../../Components/Breadcrumbs/Breadcrumbs";
import { method } from "lodash";
import { API_Endpoint } from "../../../../Configuration/Settings";
import { encryptData } from "../../../../utils/encryptData";
import axios from "axios";
import { decryptData } from "../../../../utils/decryptData";
import Roles_Data from "../../../../data/Roles_Data.json";
import {
  IconButton,
  InputLabel,
  Pagination,
  Select,
  SelectChangeEvent,
  Stack,
  TextField,
} from "@mui/material";
import { Button, FormControl, MenuItem } from "@material-ui/core";
import { toast, ToastContainer } from "react-toastify";
import { User_Context } from "../../../../Contexts/User";
import {
  Client_Names,
  depositStates,
  Responsibilities,
} from "../../../../Configuration/Enums";
import SearchBar from "../../../../Components/SearchBox/Search";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import VisibilityIcon from "@mui/icons-material/Visibility";
import Loader from "../../../../Components/Loader/Loader";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@material-ui/core";
import Reusable_Input from "../../../../Components/InputField/InputField";
import Stateful_Select from "../../../../Components/Dropdown/Dropdown";
import { API_Handler } from "../../../../API/API_Handler";
import { fetchUserGetAll } from "../../../../API/userGetAll";
import CallingBtn from "../../../../Components/CallingBtn";
import MultipleSelect from "../../../../Components/Dropdown/MultipleDropdown";
import SearchIcon from "@mui/icons-material/Search";
import {
  CampaignNameList,
  dateTime,
  formatDate,
  formatedTime,
} from "../../../../utils/utility";

// Calculate three day dates
const today = new Date();
const threeDaysAgo = new Date();
threeDaysAgo.setDate(today.getDate() - 3);
const formateDate = (date: any) => date.toISOString().split("T")[0];

const NewRegisterUsers = () => {
  let location = useLocation();
  const [reportData, setReportData] = useState<any>([]);
  const [roleNames, setRoleNames] = useState<any>({});
  const [selectedReportId, setSelectedReportId] = useState<any>("");
  const [login, setLogin] = useState(false);
  const [previousGetUsersFilter, setPreviousGetUsersFilter] = useState({});
  const [startDate, setStartDate] = useState<any>(
    new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
  );
  const [endDate, setEndDate] = useState<any>(
    new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
  );
  const [loading, setLoading] = useState(false);
  const [searchActiveUserMob, setSearchActiveUserMob] = useState<string>("");
  const [searchAccNo, setSearchAccNo] = useState<string>("");
  const [searchActiveUserAccNo, setSearchActiveUserAccNo] =
    useState<string>("");
  const [searchAadharNo, setSearchAadharNo] = useState<string>("");
  const [searchActiveUserAadharNo, setSearchActiveUserAadharNo] =
    useState<string>("");
  const [searchEmail, setSearchEmail] = useState<string>("");
  const [searchActiveUserEmail, setSearchActiveUserEmail] =
    useState<string>("");
  const [searchAddress, setSearchAddress] = useState<string>("");
  const [searchReferred, setSearchReferred] = useState<string>("");
  const [searchPlatform, setSearchPlatform] = useState<string>("");
  const [searchActiveUserAddress, setSearchActiveUserAddress] =
    useState<string>("");
  const [searchState, setSearchState] = useState<string>("");
  const [searchActiveUserState, setSearchActiveUserState] =
    useState<string>("");
  const [searchName, setSearchName] = useState<string>("");
  const [searchMob, setSearchMob] = useState(() => {
    const savedState = localStorage.getItem("searchState");
    return savedState ? JSON.parse(savedState).searchMob || "" : "";
  });
  const [actionPopup, setActionPopup] = useState<string>("");
  const [searchBalance, setSearchBalance] = useState("");
  const [appClientName, setAppClientName] = useState("");
  const [selectVersionType, setSelectedVersionType] = useState("");
  const [Selected_Current_App_Version, set_Selected_Current_App_Version] =
    useState("");
  const [Selected_Updated_App_Version, set_Selected_Updated_App_Version] =
    useState("");
  const [currentAppVersions, setCurrentAppVersions] = useState([]);
  const [updatedAppVersions, setUpdatedAppVersions] = useState([]);
  const [searchReferalCodeUser, setSearchReferalCodeUser] = useState("");
  const [searchPlayInStatus, setSearchPlayInStatus] = useState("");
  const [userComesFrom, setUserComesFrom] = useState("");
  const [searchDpId, setSearchDpId] = useState("");
  const [remarkError, setRemarkError] = useState<boolean>(false);
  const [remarkHelperText, setRemarkHelpertext] = useState<string>("");
  const [itemsPerPage, setItemsPerPage] = useState<number>(() => {
    const savedItemsPerPage = localStorage.getItem("walletHistoryItemsPerPage");
    return savedItemsPerPage ? parseInt(savedItemsPerPage, 10) : 10;
  });
  const [currentPage, setCurrentPage] = useState<number>(() => {
    const storedPage = localStorage.getItem("currentPage");
    const parsedPage = storedPage ? parseInt(storedPage, 10) : 1;
    return isNaN(parsedPage) ? 1 : parsedPage;
  });
  const [totalPages, setTotalPages] = useState(1);
  const [totalUser, setTotalUser] = useState<number>(0);
  const [totalUserCount, setTotalUserCount] = useState<number>(0);
  const [users, setusers] = useState<any[]>([]);
  const { User } = useContext<any>(User_Context);
  const loginEmpCode: string | undefined = User?.data?.empCode;
  const [selectUserEditError, setSelectUserEditError] = useState(false);
  const [singleAppVersionData, setSingleAppVersionData] = useState<any>({});
  const [allAppVersions, setAllAppVersions] = useState<any>({});
  const [blockingUser_ID, setBlocking_UserId] = useState("");
  const [blockUser, setBlockUser] = useState<boolean>();
  const [openPopup, setOpenPopup] = useState<boolean>(false);
  const [openCommentPopup, setOpenCommentPopup] = useState(false);
  const [openViewCommentsPopup, setOpenViewCommentsPopup] = useState(false);
  const [openViewCallLogsPopup, setOpenViewCallLogsPopup] = useState(false);
  const [viewComments, setViewComments] = useState<any[]>([]);
  const [viewCallLogs, setViewCallLogs] = useState<any[]>([]);
  const [viewCommentsUserName, setViewCommentsUserName] = useState("");
  const [viewCallLogsUserName, setViewCallLogsUserName] = useState("");
  const [commentInput, setCommentInput] = useState("");
  const [commenterId, setCommenterId] = useState("");
  const [selectedState, setSelectedState] = useState<any>([]);
  const [selectedActiveFilter, setSelectedActiveFilter] = useState<string>("All");
  const [newRegistrationFilter, setNewRegistrationFilter] =
    useState<string>("True");
  const [nonPerforming, setNonPerforming] = useState(false);
  const [otherState, setOtherState] = useState(false);
  const [remark, setRemark] = useState<string>("");
  const [campaignName, setCampaignName] = useState("");
  const [checked, setChecked] = useState(false);
  const Filtered_Client_Names: any = User.data?.clientName
    ? User.data.clientName
    : User.data?.allotedApps
      ? User.data.allotedApps
      : Client_Names;

  const SERVER_MAP: Record<string, string> = {
    "1": "api2",
    "3": "api",
    default: "api",
  };

  const serverPrefix =
    SERVER_MAP?.[User?.data?.serverId] || SERVER_MAP?.default;

  const Handle_App_Client_Name = (event: SelectChangeEvent<string>) => {
    setAppClientName(event.target.value);
  };

  const handleSearchReferalCodeUser = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    setSearchReferalCodeUser(event.target.value);
  };

  const handleSearchName = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchName(event.target.value);
  };

  const handleSearchMob = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchMob(event.target.value);
  };
  const handleSearchAccNo = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchAccNo(event.target.value);
  };
  const handleSearchAadharNo = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchAadharNo(event.target.value);
  };
  const handleSearchEmail = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchEmail(event.target.value);
  };
  const handleSearchAddress = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchAddress(event.target.value);
  };
  const handleSearchState = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchState(event.target.value);
  };
  const handleSearchBalance = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchBalance(event.target.value);
  };
  const handleSearchReferred = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchReferred(event.target.value);
  };
  const handleSearchPlatform = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchPlatform(event.target.value);
  };
  const handleSearchDpId = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchDpId(event.target.value);
  };

  const handlePlayInStatus = (event: any) => {
    setSearchPlayInStatus(event.target.value);
  };

  // get Reports

  const getAllUsers = (event?: any, options?: { force?: boolean }) => {
    setLoading(true);

    const isEmptyObject = (obj = {}) => {
      return Object.keys(obj).length === 0;
    };

    // Declare filter as Partial of the defined type
    let filter: Partial<{
      email: string;
      mobile: string;
      name: string;
      city: string;
      state: string | string[];
      accountNumber: string;
      aadhaarNumber: string;
      deviceType: string;
      referredCode: string;
      _id: string;
      //subDomain key referring Platform key
      subDomain: string;
      balance: number;
      currentAppVersion?: string;
      clientName?: string;
      referralCodeUser?: string;
      played?: string;
      userComesFrom?: string;
      startDate?: string;
      endDate?: string;
      empCode?: string;
      active?: boolean;
      nonPerforming?: boolean;
    }> = {
      email: searchEmail || undefined,
      mobile: searchMob || undefined,
      name: searchName || undefined,
      city: searchAddress || undefined,
      // state: searchState || undefined,
      accountNumber: searchAccNo || undefined,
      aadhaarNumber: searchAadharNo || undefined,
      referredCode: searchReferred || undefined,
      deviceType: undefined,
      subDomain: searchPlatform || undefined,
      balance: parseInt(searchBalance) || undefined,
      currentAppVersion: Selected_Current_App_Version || undefined,
      clientName: appClientName || undefined,
      referralCodeUser: searchReferalCodeUser || undefined,
      played: searchPlayInStatus || undefined,
      _id: searchDpId || undefined,
      userComesFrom: userComesFrom || undefined,
    };

    if (otherState) {
      filter.state = "other";
    } else if (selectedState?.length > 0) {
      filter.state = selectedState;
    }

    if (selectedActiveFilter === "Active") {
      filter.active = true;
    } else if (selectedActiveFilter === "InActive") {
      filter.active = false;
    }

    if (nonPerforming) {
      filter.nonPerforming = true;
    }

    // Login has empCode → only own records; else show all
    // if (loginEmpCode) {
    //   filter.empCode = loginEmpCode;
    // }

    filter = Object.fromEntries(
      Object.entries(filter).filter(([_, v]) => v !== undefined),
    );

    // Determine if a new filter is applied
    const isNewFilter =
      JSON.stringify(filter) !== JSON.stringify(previousGetUsersFilter);
    const pageNo = isNewFilter ? 1 : currentPage;

    // Update the previous filter state if a new filter is applied
    if (isNewFilter) {
      setPreviousGetUsersFilter(filter);
      setCurrentPage(1);
    }

    let data: any = {};
    if (startDate && endDate) {
      data = {
        itemsPerPage: itemsPerPage,
        // When the filter is not empty, set pageNo to 1, otherwise use currentPage
        pageNo: pageNo,
        filter: filter,
        startDate: startDate,
        endDate: endDate,
      };
    }

    if (User.data.clientName || User.data?.allotedApps) {
      data.app = User.data.clientName || User.data?.allotedApps;
    }

    data.newRegistration = newRegistrationFilter === "True";

    console.log("Payload =====>", data);

    return fetchUserGetAll(data, {
      force: options?.force,
      token: User.token,
    })
      .then((result) => {
        console.log("result::",result);
        
        let items = checked
          ? (result.items?.filter((v: any) => !v?.activeUser) ?? [])
          : (result.items ?? []);

        // Client-side guard if API returns all even when empCode is sent
        // if (loginEmpCode) {
        //   items = items.filter(
        //     (v: any) =>
        //       String(v?.empCode ?? "").trim() === String(loginEmpCode).trim() &&
        //       String(v?.empCode ?? "").trim() !== "",
        //   );
        // }

        const states =
          User?.data?.accessibleStates?.map((s: string) => s.toLowerCase()) ??
          [];

        const filteredItems =
          states.length === 0
            ? items
            : items.filter((item: any) =>
                states.includes(item?.state?.toLowerCase()),
              );

        const sortedItems = filteredItems.sort((a: any, b: any) => {
          const valA = a?.userComesFrom?.trim();
          const valB = b?.userComesFrom?.trim();

          if (!valA && valB) return 1;
          if (valA && !valB) return -1;

          return (valA || "").localeCompare(valB || "");
        });

        console.log("sortedItems::",sortedItems);
        
        setusers(sortedItems);
        setTotalPages(result.totalPages);
        setTotalUserCount(result.total);
        setLoading(false);
      })
      .catch((error) => {
        console.log(error);
        setLoading(false);
        toast.error(error.response?.data?.message);
      });
  };

  useEffect(() => {
    if (reportData) {
      let firstId = Object.keys(reportData)[0];
      setSelectedReportId(firstId);
    }
  }, [roleNames, reportData]);

  const handleVersionChange = (e: any) => {
    if (selectVersionType === "CURRENT") {
      set_Selected_Current_App_Version(e.target.value);
    }
  };

  const Change_App_Version = (type: any) => {
    setSelectedVersionType(type);
    let data = {
      currentAppVersion: type === "CURRENT" && true,
    };
    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: `${API_Endpoint}/User/app-version`,
      headers: {
        Authorization: `Bearer ${User.token}`,
      },
      data: { token: encryptData(data) },
    };

    API_Handler.request(config)
      .then((response) => {
        if (type === "CURRENT" && response.data) {
          setCurrentAppVersions(response.data.data.payload);
        }
      })
      .catch((error) => {
        console.log("error");
      });
  };

  // getting single app version data for app version

  const getAppVersions = () => {
    let data = {
      clientName: appClientName,
    };
    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: `${API_Endpoint}/User/updated-app-version`,
      headers: {
        Authorization: `Bearer ${User.token}`,
      },
      data: { token: encryptData(data) },
    };

    API_Handler.request(config)
      .then(async (response) => {
        response.data.data = await decryptData(response.data.data);
        setSingleAppVersionData(response.data.data.payload);
      })
      .catch((error) => {
        console.log(error);
      });
  };

  const getAllVersions = () => {
    let data = {};
    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: `${API_Endpoint}/User/All-app-version`,
      headers: {
        Authorization: `Bearer ${User.token}`,
      },
      data: { token: encryptData(data) },
    };

    API_Handler.request(config)
      .then(async (response) => {
        let API_RESPONSE = await decryptData(response.data.data);
        let apiData = API_RESPONSE.payload;
        const filteredData = apiData.reduce((acc: any, item: any) => {
          acc[item.clientName] = item.version;
          return acc;
        }, {});
        setAllAppVersions(filteredData);
      })
      .catch((error) => {
        console.log(error);
      });
  };

  // copty mobile
  const copyMobile = async (textToCopy: any) => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      toast.success(`${textToCopy} Coppied`);
    } catch (err) {
      console.log(err);
    }
  };

  const handleActionSubmit = () => {
    if (remark != "" && blockingUser_ID != "") {
      setOpenPopup(false);
      setLoading(true);
      let data = {
        _id: blockingUser_ID,
        blockUser: blockUser,
        blockUserReason: remark,
      };

      let config = {
        method: "post",
        maxBodyLength: Infinity,
        url: `${API_Endpoint}/User/blockAndUnblockUser`,
        headers: {
          Authorization: `Bearer ${User.token}`,
        },
        data: { token: encryptData(data) },
      };

      axios
        .request(config)
        .then(async (response) => {
          response.data.data = await decryptData(response.data.data);
          setLoading(false);
          getAllUsers(undefined, { force: true });
          setRemark("");
          setBlocking_UserId("");
        })
        .catch((error: any) => {
          console.log(error);
          setLoading(false);
          toast.error(error.response.data.message);
        });
    } else {
      toast.error("something wrong try again letter");
    }
  };

  const handleBlockAction = (_id: string, blockUser: boolean) => {
    setBlocking_UserId(_id);
    setBlockUser(blockUser);
    setOpenPopup(true);
  };

  const handleRemark = (e: ChangeEvent<HTMLInputElement>) => {
    setRemark(e.target.value);
    setRemarkError(false);
  };

  const getUserRegistrationComments = (userRow: any) => {
    const comments =
      userRow?.newRegistrationComments ||
      userRow?.registrationComments ||
      userRow?.comments ||
      [];
    return Array.isArray(comments) ? comments : [];
  };

  const getUserCallLogsForNewRegistration = (userRow: any) => {
    const logs =
      userRow?.callLogsForNewRegistration ||
      userRow?.callLogs ||
      [];
    return Array.isArray(logs) ? logs : [];
  };

  const handleAddCommentClick = (id: any) => {
    setOpenCommentPopup(true);
    setCommenterId(id);
  };

  const handleChangeCommentInput = (e: ChangeEvent<HTMLInputElement>) => {
    setCommentInput(e.target.value);
  };

  const handleCommentSubmitions = (e: FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim()) {
      toast.error("Please enter a comment");
      return;
    }
    setLoading(true);
    let data = {
      _id: commenterId,
      comment: commentInput,
      who: {
        userId: User.data._id,
        userName: User.data.name,
      },
    };
    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: `${API_Endpoint}/User/add-new-registration-comment`,
      headers: {
        Authorization: `Bearer ${User.token}`,
      },
      data: { token: encryptData(data) },
    };
    API_Handler.request(config)
      .then(() => {
        setLoading(false);
        setOpenCommentPopup(false);
        setCommenterId("");
        toast.success("Comment added successfully");
        getAllUsers(undefined, { force: true });
      })
      .catch((error) => {
        console.log(error);
        setLoading(false);
        toast.error(error?.response?.data?.message || "Failed to add comment");
      })
      .finally(() => {
        setCommentInput("");
      });
  };

  const handleViewAllComment = (userRow: any) => {
    setViewComments(getUserRegistrationComments(userRow));
    setViewCommentsUserName(userRow?.name || "");
    setOpenViewCommentsPopup(true);
  };

  const handleViewCallLogs = (userRow: any) => {
    setViewCallLogs(getUserCallLogsForNewRegistration(userRow));
    setViewCallLogsUserName(userRow?.name || "");
    setOpenViewCallLogsPopup(true);
  };

  const handlePerPage = (newValue: any) => {
    // setItemsPerPage(newValue)
    const perPage = parseInt(newValue, 10);
    setItemsPerPage(perPage);
    localStorage.setItem("itemPerPageNonperform", perPage?.toString());
    localStorage.setItem("itemsPerPageActiveUser", perPage?.toString());
    localStorage.setItem("walletHistoryItemsPerPage", perPage.toString());
  };

  const handlePageChange = (
    event: React.ChangeEvent<unknown>,
    New_Page: number,
  ) => {
    setCurrentPage(New_Page);
  };

  useEffect(() => {
    getAllUsers();
  }, [
    itemsPerPage,
    checked,
    searchPlayInStatus,
    currentPage,
    appClientName,
    Selected_Current_App_Version,
    selectedActiveFilter,
    newRegistrationFilter,
    nonPerforming,
    otherState,
  ]);

  const addToDialer = async () => {
    try {
      if (!campaignName) {
        toast.error("Campaign Name should not be empty");
        return;
      }
      if (!users?.length) {
        toast.error("No users to add to dialer");
        return;
      }

      const SERVER_MAP_BY_IP: Record<string, string> = {
        "49.206.26.7": "api2",
        "3.200": "api",
        default: "api",
      };

      const filterCampaignRes: any =
        typeof campaignName === "object"
          ? campaignName
          : CampaignNameList?.find(
              (v: any) => v?.id === campaignName || v?.name === campaignName,
            );

      if (!filterCampaignRes?.id) {
        toast.error("Please select a valid campaign");
        return;
      }

      const dialerServerPrefix =
        SERVER_MAP_BY_IP?.[filterCampaignRes?.serverId] ||
        SERVER_MAP_BY_IP?.default;
      const listId = Math.floor(10000 + Math.random() * 90000);

      const res: any = [];
      users?.map((item: any) => {
        res?.push({
          first_name: item?.name,
          last_name: "",
          phone_number: item?.mobile,
          city: item?.city ?? "",
          state: item?.state ?? "",
          email: item?.clientName ?? "",
          comments: item?.clientName ?? "",
          province: item?._id,
        });
      });
      const response = await axios.post(
        `https://${dialerServerPrefix}.ganesha999.com/API/`,

        {
          list_id: listId,
          list_name: filterCampaignRes?.name,
          campaign_id: filterCampaignRes?.id,
          leads: res,
        },

        {
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
      const callObj = response?.data;
      if (callObj?.success || callObj?.status === "success") {
        toast.success(
          callObj?.message ||
            `${callObj?.inserted ?? res.length} inserted successfully.`,
        );
        toast.info(`Data pushed on ${listId} List ID`);
        setCampaignName("");
      } else {
        toast.error(callObj?.message || "Failed to add to dialer");
      }
    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast.error(error?.response?.data?.message || "API request failed");
    }
  };

  return (
    <>
      <ToastContainer autoClose={2000} position="top-center" />
      {loading && <Loader />}
      <div className="g-sidenav-show  bg-gray-100">
        <Sidenav />
        <main className="main-content position-relative">
          <div>
            <Dialog open={openPopup} onClose={() => setOpenPopup(false)}>
              <DialogContent>
                <form onSubmit={handleActionSubmit}>
                  {actionPopup === "Approved" ? (
                    <div className="d-flex justify-content-center">
                      <p>Are you sure ?</p>
                    </div>
                  ) : (
                    <div>
                      <Reusable_Input
                        required={true}
                        type={"text"}
                        label={"Please enter remark"}
                        fullWidth={true}
                        value={remark}
                        error={remarkError}
                        helperText={remarkHelperText}
                        onChange={handleRemark}
                      />
                    </div>
                  )}
                  <DialogActions>
                    <Button
                      className="btn-popup"
                      variant="outlined"
                      onClick={() => setOpenPopup(false)}
                      color="primary"
                    >
                      Cancel
                    </Button>
                    <Button
                      className="btn-popup"
                      variant="outlined"
                      type="submit"
                      color="primary"
                    >
                      Submit
                    </Button>
                  </DialogActions>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog
              open={openCommentPopup}
              onClose={() => {
                setOpenCommentPopup(false);
                setCommentInput("");
              }}
              maxWidth="sm"
              fullWidth
              className="new-reg-add-comment-modal"
            >
              <DialogTitle>Add Comment</DialogTitle>
              <DialogContent>
                <form onSubmit={handleCommentSubmitions}>
                  <div style={{ minWidth: 420, paddingTop: 8 }}>
                    <TextField
                      type={"text"}
                      multiline={true}
                      rows={6}
                      label={"Please enter Comment"}
                      fullWidth={true}
                      value={commentInput}
                      onChange={handleChangeCommentInput}
                    />
                  </div>
                  <DialogActions>
                    <Button
                      className="btn-popup"
                      variant="outlined"
                      onClick={() => {
                        setOpenCommentPopup(false);
                        setCommentInput("");
                      }}
                      color="primary"
                    >
                      Cancel
                    </Button>
                    <Button
                      className="btn-popup"
                      variant="outlined"
                      type="submit"
                      color="primary"
                    >
                      Submit
                    </Button>
                  </DialogActions>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog
              open={openViewCommentsPopup}
              onClose={() => setOpenViewCommentsPopup(false)}
              maxWidth="sm"
              fullWidth
              className="new-reg-comments-modal"
            >
              <DialogTitle>
                Comments
                {viewCommentsUserName ? ` — ${viewCommentsUserName}` : ""}
              </DialogTitle>
              <DialogContent>
                {viewComments.length > 0 ? (
                  <div className="new-reg-comments-list">
                    {viewComments.map((item: any, index: number) => {
                      const commentDate =
                        item?.date || item?.createdOn || item?.createdAt;
                      return (
                        <div className="new-reg-comment-card" key={index}>
                          <p className="new-reg-comment-card__text">
                            {item?.comment || "-"}
                          </p>
                          <div className="new-reg-comment-card__meta">
                            <span>
                              By:{" "}
                              {item?.who?.userName ||
                                item?.userName ||
                                item?.commented_by ||
                                "-"}
                            </span>
                            {commentDate && (
                              <span>
                                {formatDate(commentDate)} |{" "}
                                {formatedTime(commentDate)}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="new-reg-comments-empty">No Comments</div>
                )}
              </DialogContent>
              <DialogActions>
                <Button
                  className="btn-popup"
                  variant="outlined"
                  onClick={() => setOpenViewCommentsPopup(false)}
                  color="primary"
                >
                  Close
                </Button>
              </DialogActions>
            </Dialog>
            <Dialog
              open={openViewCallLogsPopup}
              onClose={() => setOpenViewCallLogsPopup(false)}
              maxWidth="sm"
              fullWidth
              className="new-reg-comments-modal"
            >
              <DialogTitle>
                Call Logs
                {viewCallLogsUserName ? ` — ${viewCallLogsUserName}` : ""}
              </DialogTitle>
              <DialogContent>
                {viewCallLogs.length > 0 ? (
                  <div className="new-reg-comments-list">
                    {viewCallLogs.map((item: any, index: number) => {
                      const logDate =
                        item?.date || item?.createdOn || item?.createdAt;
                      return (
                        <div className="new-reg-comment-card" key={index}>
                          <p className="new-reg-comment-card__text">
                            Called by:{" "}
                            {item?.who?.userName ||
                              item?.userName ||
                              item?.called_by ||
                              "-"}
                          </p>
                          <div className="new-reg-comment-card__meta">
                            {item?.who?.userId && (
                              <span>Admin ID: {item.who.userId}</span>
                            )}
                            {logDate && (
                              <span>
                                {formatDate(logDate)} | {formatedTime(logDate)}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="new-reg-comments-empty">No Call Logs</div>
                )}
              </DialogContent>
              <DialogActions>
                <Button
                  className="btn-popup"
                  variant="outlined"
                  onClick={() => setOpenViewCallLogsPopup(false)}
                  color="primary"
                >
                  Close
                </Button>
              </DialogActions>
            </Dialog>
          </div>
          <div style={{ background: "#f8f9fa" }}>
            <Breadcrumbs tab={"New Register Users"} />
            <div className="container-fluid">
              <div className="row tp-form">
                <div className="col-6 col-xl-2 col-sm-4 pdrt">
                  <label className="lbl">From Date</label>
                  <input
                    type="date"
                    className="form-control"
                    placeholder="From Date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="col-6 col-xl-2 col-sm-4 pdrt">
                  <label className="lbl">To Date</label>
                  <input
                    type="date"
                    className="form-control"
                    placeholder="To Date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
                <div className="col-6 col-xl-2 col-sm-4 pdrt btn-top role-mob role-web mt-1">
                  <label className="lbl">Items Per Page</label>
                  <Stateful_Select
                    // label="Items Per Page"
                    value={itemsPerPage.toString()}
                    onChange={(newValue: any) => handlePerPage(newValue)}
                    options={[
                      "10",
                      "25",
                      "50",
                      "75",
                      "100",
                      "500",
                      "1000",
                      "1500",
                      "2000",
                    ]}
                  />
                </div>
                <div className="col-6 col-xl-2 col-sm-4 pdrt btn-top role-mob role-web mt-0">
                  <label className="lbl">Campaign List</label>
                  <div className="mt-1">
                    <Stateful_Select
                      value={campaignName}
                      onChange={(newValue: any) => setCampaignName(newValue)}
                      options={CampaignNameList}
                      className="deposit-select"
                    />
                  </div>
                </div>
                <div className="col-6 col-xl-2 col-sm-4 pdrt btn-top role-mob role-web mt-0">
                  <label className="lbl">Active Status</label>
                  <div className="mt-1">
                    <Stateful_Select
                      value={selectedActiveFilter}
                      onChange={(newValue: any) =>
                        setSelectedActiveFilter(newValue)
                      }
                      options={["All", "Active", "InActive"]}
                      className="deposit-select"
                    />
                  </div>
                </div>
                <div className="col-6 col-xl-2 col-sm-4 pdrt btn-top role-mob role-web mt-0">
                  <label className="lbl">New Registration</label>
                  <div className="mt-1">
                    <Stateful_Select
                      value={newRegistrationFilter}
                      onChange={(newValue: any) =>
                        setNewRegistrationFilter(newValue)
                      }
                      options={["True", "False"]}
                      className="deposit-select"
                    />
                  </div>
                </div>
                <div className="col-6 col-xl-2 col-sm-4 pdrt d-flex align-items-end">
                  <label className="lbl">
                    <input
                      type="checkbox"
                      checked={otherState}
                      onChange={(e) => {
                        const checkedOther = e.target.checked;
                        setOtherState(checkedOther);
                        if (checkedOther) setSelectedState([]);
                      }}
                      style={{ marginRight: 6 }}
                    />
                    Other State
                  </label>
                </div>
                <div className="col-6 col-xl-2 col-sm-4 pdrt d-flex align-items-end">
                  <label className="lbl">
                    <input
                      type="checkbox"
                      checked={nonPerforming}
                      onChange={(e) => setNonPerforming(e.target.checked)}
                      style={{ marginRight: 6 }}
                    />
                    Non-Performing
                  </label>
                </div>
                <div className="col-6 col-xl-2 col-sm-4 pdrt">
                  <label className="lbl"></label>
                  <a onClick={() => getAllUsers(undefined, { force: true })} className="sechBtn mt-1">
                    Apply
                  </a>
                </div>
                <div className="col-6 col-xl-2 col-sm-4 pdrt">
                  <label className="lbl"></label>
                  <a
                    id="alldata"
                    onClick={(e) => addToDialer()}
                    className="sechBtn mt-1"
                  >
                    Add to Dialer
                  </a>
                </div>
                 <div className="col-6 col-xl-2 col-sm-4 pdrt  align-items-center mt-3">
                      <label className="lbl"></label>
                      <b>Total User : {totalUserCount ?? 0}</b>
                    </div>
              </div>

              <div className="col-12 mt-4">
                <div className="table-responsive">
                  <table className="table table-view">
                    <thead>
                      <tr>
                        <th></th>
                        <th>Name</th>
                        <th>DP ID</th>
                        <th>
                          User Comes
                          <br />
                          From
                        </th>
                        <th>Balance</th>
                        <th>
                          Last <br /> Activity
                        </th>
                        <th>
                          User Bank <br /> Name
                        </th>

                        <th>
                          App <br /> Name
                        </th>
                        <th>Play In</th>
                        <th>
                          User Encrypted <br /> Dp Id
                        </th>
                        {User?.data?.Responsibilities?.includes(
                          Responsibilities.contact_visibility_none,
                        ) === false && (
                          <th>
                            Mobile <br /> Phone
                          </th>
                        )}
                        <th>Kyc</th>
                        <th>
                          Account <br /> Number
                        </th>
                        <th>
                          Aadhar <br /> Number
                        </th>
                        {User?.data?.Responsibilities?.includes(
                          Responsibilities.contact_visibility_none,
                        ) === false && <th>Email</th>}
                        <th>City</th>
                        <th>State</th>
                        <th>
                          previous caller <br /> name
                        </th>
                        <th>
                          Previous caller <br /> Dp_ID
                        </th>
                        <th>Employee Code</th>
                        <th>
                          Current <br /> Caller{" "}
                        </th>
                        <th>
                          Referred <br /> Referral Code
                        </th>

                        <th>
                          Referral <br /> Code
                        </th>
                        <th>
                          Device <br /> Type
                        </th>
                        {/* <th>Platform</th> */}
                        <th>
                          Player App <br /> Version
                        </th>
                        <th>
                          App <br /> Version
                        </th>
                        {/* <th>Balance</th> */}
                        <th>Created</th>
                        <th>Time</th>
                        {/* <th>
                          Last <br /> Activity
                        </th> */}
                        {/* <th>Wager</th> */}
                        <th>
                          Bonus <br /> Balance
                        </th>
                        {User.data.Responsibilities?.includes(
                          Responsibilities.withdrawals_button,
                        ) && <th>Action</th>}
                        <th>
                          Add <br /> Comment
                        </th>
                        <th>
                          Call <br /> Logs
                        </th>
                        <th>
                          Block User <br /> Reason
                        </th>
                        <th>Aadhar Address</th>
                      </tr>
                    </thead>
                    <thead>
                      <tr className="bg-table">
                        <th className="thdr"></th>
                        <th className="thdr">
                          <div className="d-flex justify-content-center">
                            <SearchBar
                              value={searchName}
                              onChange={handleSearchName}
                              onSearch={() => getAllUsers(undefined, { force: true })}
                              placeholder="Search by name"
                            />
                          </div>
                        </th>
                        <th className="thdr">
                          <div className="d-flex justify-content-center">
                            <SearchBar
                              value={searchDpId}
                              onChange={handleSearchDpId}
                              onSearch={() => getAllUsers(undefined, { force: true })}
                              placeholder="Search by DP Id"
                            />
                          </div>
                        </th>
                        <th className="thdr">
                          <div className="d-flex justify-content-center">
                            <SearchBar
                              value={userComesFrom}
                              onChange={(e: any) =>
                                setUserComesFrom(e?.target?.value)
                              }
                              onSearch={() => getAllUsers(undefined, { force: true })}
                              placeholder="User Comes from"
                            />
                          </div>
                        </th>
                         <th className="thdr">
                          <div className="d-flex justify-content-center">
                            <SearchBar
                              value={searchBalance}
                              onChange={handleSearchBalance}
                              onSearch={() => getAllUsers(undefined, { force: true })}
                              placeholder="Search by Balance"
                            />
                          </div>
                        </th>
                        <th className="thdr">
                          <div>
                            <label>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => setChecked(e.target.checked)}
                              />
                              Show Empty Record
                            </label>
                          </div>
                        </th>
                        <th className="thdr"></th>
                        <th className="thdr">
                          <Select
                            labelId="demo-select-small-label"
                            id="demo-select-small"
                            label="Select App Name"
                            value={appClientName}
                            onChange={Handle_App_Client_Name}
                            error={selectUserEditError}
                          >
                            {Filtered_Client_Names?.map(
                              (appName: any, index: number) => (
                                <MenuItem key={index} value={appName}>
                                  {appName}
                                </MenuItem>
                              ),
                            )}
                          </Select>
                        </th>
                        <th className="thdr">
                          <div className="d-flex justify-content-center withdraw-select">
                            <FormControl fullWidth>
                              <InputLabel id="demo-simple-select-label">
                                Select Win In
                              </InputLabel>
                              <Select
                                labelId="demo-simple-select-label"
                                id="demo-simple-select"
                                value={searchPlayInStatus}
                                label="Age"
                                onChange={(e: any) => handlePlayInStatus(e)}
                              >
                                <MenuItem value={"E"}>E</MenuItem>
                                <MenuItem value={"C"}>C</MenuItem>
                                <MenuItem value={"S"}>S</MenuItem>
                              </Select>
                            </FormControl>
                          </div>
                        </th>
                        <th className="thdr"></th>
                        {User?.data?.Responsibilities?.includes(
                          Responsibilities.contact_visibility_none,
                        ) === false && <th className="thdr"></th>}
                        <th className="thdr"></th>
                        <th className="thdr">
                          <div className="d-flex justify-content-center">
                            <SearchBar
                              value={searchAccNo}
                              onChange={handleSearchAccNo}
                              onSearch={() => getAllUsers(undefined, { force: true })}
                              placeholder="Search by acc no"
                            />
                          </div>
                        </th>
                        <th className="thdr">
                          <div className="d-flex justify-content-center">
                            <SearchBar
                              value={searchAadharNo}
                              onChange={handleSearchAadharNo}
                              onSearch={() => getAllUsers(undefined, { force: true })}
                              placeholder="Search by aadhar no"
                            />
                          </div>
                        </th>
                        {User?.data?.Responsibilities?.includes(
                          Responsibilities.contact_visibility_none,
                        ) === false && (
                          <th className="thdr">
                            <div className="d-flex justify-content-center">
                              <SearchBar
                                value={searchEmail}
                                onChange={handleSearchEmail}
                                onSearch={() => getAllUsers(undefined, { force: true })}
                                placeholder="Search by email"
                              />
                            </div>
                          </th>
                        )}
                        <th className="thdr">
                          <div className="d-flex justify-content-center">
                            <SearchBar
                              value={searchAddress}
                              onChange={handleSearchAddress}
                              onSearch={() => getAllUsers(undefined, { force: true })}
                              placeholder="Search by city"
                            />
                          </div>
                        </th>
                        <th className="thdr">
                          <div
                            style={{
                              flexDirection: "column",
                              display: "flex",
                              marginTop: 1,
                              maxWidth: 250,
                              paddingTop: 3,
                            }}
                          >
                            <MultipleSelect
                              value={selectedState}
                              onChange={(selectedIds: string[]) => {
                                setOtherState(false);
                                setSelectedState(selectedIds);
                              }}
                              options={depositStates}
                              className="deposit-select"
                            />
                            <IconButton
                              onClick={() => getAllUsers(undefined, { force: true })}
                              type="button"
                              sx={{ p: "10px 0px", mt: 2 }}
                              aria-label="search"
                              className="icon-button-user"
                            >
                              <SearchIcon />
                            </IconButton>
                          </div>
                        </th>
                        <th className="thdr"></th>
                        <th className="thdr"></th>
                        <th className="thdr"></th>
                        <th className="thdr"></th>

                        <th className="thdr">
                          <div className="d-flex justify-content-center">
                            <SearchBar
                              value={searchReferred}
                              onChange={handleSearchReferred}
                              onSearch={() => getAllUsers(undefined, { force: true })}
                              placeholder="Search by Referred Code"
                            />
                          </div>
                        </th>
                        <th className="thdr">
                          <div className="d-flex justify-content-center">
                            <SearchBar
                              value={searchReferalCodeUser}
                              onChange={handleSearchReferalCodeUser}
                              onSearch={() => getAllUsers(undefined, { force: true })}
                              placeholder="Referal Code"
                            />
                          </div>
                        </th>
                        <th className="thdr"></th>
                        {/* <th className="thdr">
																<div className="d-flex justify-content-center">
																	<SearchBar
																		value={searchPlatform}
																		onChange={handleSearchPlatform}
																		onSearch={() => getAllUsers(undefined, { force: true })}
																		placeholder="Search by Platform"
																	/>
																</div>
															</th> */}
                        <th className="thdr">
                          <FormControl
                            variant="outlined"
                            fullWidth
                            size="small"
                          >
                            <InputLabel>
                              Player App <br /> Version
                            </InputLabel>
                            <Select
                              MenuProps={{ disablePortal: true }}
                              labelId="demo-select-small-label"
                              id="demo-select-small"
                              label="Select version"
                              value={Selected_Current_App_Version}
                              onChange={(e: any) => handleVersionChange(e)}
                              onClick={() => Change_App_Version("CURRENT")}
                            >
                              {currentAppVersions?.length > 0 &&
                                currentAppVersions.map((version) => {
                                  return (
                                    <MenuItem value={version}>
                                      {version}
                                    </MenuItem>
                                  );
                                })}
                            </Select>
                          </FormControl>
                        </th>
                        <th className="thdr"></th>
                        <th className="thdr"></th>
                        {/* <th className="thdr">
                          <div className="d-flex justify-content-center">
                            <SearchBar
                              value={searchBalance}
                              onChange={handleSearchBalance}
                              onSearch={() => getAllUsers(undefined, { force: true })}
                              placeholder="Search by Balance"
                            />
                          </div>
                        </th> */}
                        {/* <th className="thdr"></th> */}
                        <th className="thdr"></th>
                        <th className="thdr"></th>
                        {/* <th className="thdr">
                          <div>
                            <label>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => setChecked(e.target.checked)}
                              />
                              Show Empty Record
                            </label>
                          </div>
                        </th> */}
                        <th className="thdr"></th>
                        {User.data.Responsibilities?.includes(
                          Responsibilities.withdrawals_button,
                        ) && <th className="thdr"></th>}
                        <th className="thdr"></th>
                        <th className="thdr"></th>
                        <th className="thdr"></th>
                        <th className="thdr"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {users?.map((User: any, index: number) => (
                        <tr id={User._id}>
                          <td>
                            {index +
                              1 +
                              (currentPage && itemsPerPage
                                ? (currentPage - 1) * itemsPerPage
                                : 0)}
                          </td>
                          <td
                            key={User._id}
                            onClick={() => {
                              const url = `/user-report/${User._id}/${User.name}`;
                              localStorage.setItem(
                                "searchState",
                                JSON.stringify({
                                  searchMob,
                                }),
                              );
                              window.open(url, "_self");
                            }}
                            style={{ cursor: "pointer" }}
                          >
                            {User.name}
                          </td>
                          <td>
                            {User?._id}
                            {/* <ContentCopyIcon
                              onClick={() => copyMobile(User?._id)}
                              style={{
                                color: "#333",
                                fontSize: "17px",
                                marginLeft: "10px",
                                cursor: "pointer",
                              }}
                            /> */}
                          </td>
                          <td>{User?.userComesFrom ?? "Company"}</td>
                          <td>{Math.floor(User?.balance)}</td>
                          <td>
                            {User.activeUser
                              ? formatDate(User?.activeUser) +
                                " | " +
                                formatedTime(User?.activeUser)
                              : ""}
                          </td>
                          <td>{User?.userBankName}</td>
                          <td>{User?.clientName}</td>
                          <td>{User?.played}</td>
                          <td>{User?.encryptedUserName}</td>
                          <td>
                            {/* {User?.data?.Responsibilities?.includes(
                              Responsibilities.show_mobile
                            )
                              ? User?.mobile
                              : `**********`} */}
                            <CallingBtn
                              item={User}
                              campaignName={"OM south"}
                              hideBotCall
                              isNewRegistration
                              onSuccess={async (calledUser: any, who: any) => {
                                const calledUserId = calledUser?._id;
                                if (!calledUserId) return;

                                const newLog = {
                                  who: who || {},
                                  date: new Date().toISOString(),
                                };

                                // Instant UI update
                                setusers((prev: any[]) =>
                                  prev.map((u: any) => {
                                    if (u._id !== calledUserId) return u;
                                    return {
                                      ...u,
                                      callLogsForNewRegistration: [
                                        ...getUserCallLogsForNewRegistration(u),
                                        newLog,
                                      ],
                                    };
                                  }),
                                );

                                // Background refresh — merge so new log is not wiped
                                try {
                                  await getAllUsers(undefined, { force: true });
                                  setusers((prev: any[]) =>
                                    prev.map((u: any) => {
                                      if (u._id !== calledUserId) return u;
                                      const logs =
                                        getUserCallLogsForNewRegistration(u);
                                      const hasCaller = logs.some(
                                        (log: any) =>
                                          String(log?.who?.userId) ===
                                          String(who?.userId),
                                      );
                                      if (hasCaller) return u;
                                      return {
                                        ...u,
                                        callLogsForNewRegistration: [
                                          ...logs,
                                          newLog,
                                        ],
                                      };
                                    }),
                                  );
                                } catch (e) {
                                  console.log(e);
                                }
                              }}
                            />
                          </td>
                          {/* <td>{User.mobile}</td> */}
                          <td>{User?.kyc === true ? "Done" : "Not Done"}</td>
                          <td>{User?.accountNumber}</td>
                          <td>{User?.aadhaarNumber}</td>
                          {/* {User.data.Responsibilities?.includes(Responsibilities.contact_visibility_none) === false && ( */}
                          <td>{User?.email}</td>
                          {/* )} */}
                          <td>{User?.city}</td>
                          <td>{User?.state}</td>
                          <td>{User?.previousCaller?.name}</td>
                          <td>{User?.previousCaller?.Dp_ID}</td>
                          <td>{User?.empCode}</td>
                          <td>{User?.currentCaller?.name}</td>
                          <td>{User?.referredCode}</td>
                          <td>{User?.referralCodeUser}</td>
                          <td>{User.deviceType}</td>
                          {/* <td>{User?.subDomain}</td> */}
                          <td>{User.currentAppVersion}</td>
                          <td>{allAppVersions[User?.clientName] ?? ""}</td>
                          {/* <td>{Math.floor(User?.balance)}</td> */}
                          <td>{formatDate(User?.createdOn)}</td>
                          <td>{formatedTime(User?.createdOn)}</td>
                          {/* <td>
                            {User.activeUser
                              ? formatDate(User?.activeUser) +
                                " | " +
                                formatedTime(User?.activeUser)
                              : ""}
                          </td> */}
                          {/* <td>{User.wager}</td> */}
                          <td>{User?.bonusWalletBalance}</td>
                          {User?.data?.Responsibilities?.includes(
                            Responsibilities.withdrawals_button,
                          ) ? (
                            <td>
                              <span>
                                <Button
                                  onClick={() =>
                                    handleBlockAction(User._id, !User.blockUser)
                                  }
                                  className="withdraw-btn"
                                  variant="contained"
                                >
                                  {User.blockUser === true
                                    ? "Un Block"
                                    : "Block"}
                                </Button>
                              </span>
                            </td>
                          ) : (
                            <td></td>
                          )}
                          <td>
                            {(() => {
                              const commentsCount =
                                getUserRegistrationComments(User).length;
                              return (
                                <div className="new-reg-comment-actions">
                                  <button
                                    onClick={() =>
                                      handleAddCommentClick(User?._id)
                                    }
                                    className="new-reg-comment-btn"
                                    type="button"
                                  >
                                    <ChatBubbleOutlineIcon
                                      style={{ fontSize: 15 }}
                                    />
                                    Comment
                                  </button>
                                  <button
                                    className="new-reg-view-all-btn"
                                    type="button"
                                    onClick={() => handleViewAllComment(User)}
                                  >
                                    <VisibilityIcon style={{ fontSize: 15 }} />
                                    View All
                                    {commentsCount > 0
                                      ? ` (${commentsCount})`
                                      : ""}
                                  </button>
                                </div>
                              );
                            })()}
                          </td>
                          <td>
                            {(() => {
                              const callLogsCount =
                                getUserCallLogsForNewRegistration(User).length;
                              const latestLog =
                                getUserCallLogsForNewRegistration(User)?.[
                                  callLogsCount - 1
                                ];
                              return (
                                <div className="new-reg-comment-actions">
                                  <div
                                    style={{
                                      fontSize: 12,
                                      color: "#475569",
                                      textAlign: "center",
                                    }}
                                  >
                                    {callLogsCount > 0
                                      ? `Last: ${
                                          latestLog?.who?.userName ||
                                          latestLog?.userName ||
                                          "-"
                                        }`
                                      : "No calls yet"}
                                  </div>
                                  <button
                                    className="new-reg-view-all-btn"
                                    type="button"
                                    onClick={() => handleViewCallLogs(User)}
                                  >
                                    <VisibilityIcon style={{ fontSize: 15 }} />
                                    View Logs
                                    {callLogsCount > 0
                                      ? ` (${callLogsCount})`
                                      : ""}
                                  </button>
                                </div>
                              );
                            })()}
                          </td>
                          <td>{User?.blockUserReason}</td>
                          <td>
                            {User?.kyc ? (
                              <>
                                <span className="aadhar-info_">
                                  Country :{" "}
                                  <strong>
                                    {User?.aadharAddress?.country}
                                  </strong>
                                </span>
                                <span className="aadhar-info_">
                                  Dist :{" "}
                                  <strong>{User?.aadharAddress?.dist}</strong>
                                </span>
                                <span className="aadhar-info_">
                                  House :{" "}
                                  <strong>{User?.aadharAddress?.house}</strong>
                                </span>
                                <br />
                                <span className="aadhar-info_">
                                  Landmark :{" "}
                                  <strong>
                                    {User?.aadharAddress?.landmark}
                                  </strong>
                                </span>
                                <span className="aadhar-info_">
                                  Loc :{" "}
                                  <strong>{User?.aadharAddress?.loc}</strong>
                                </span>
                                <br />
                                <span className="aadhar-info_">
                                  Po :{" "}
                                  <strong>{User?.aadharAddress?.po}</strong>
                                </span>
                                <span className="aadhar-info_">
                                  State :{" "}
                                  <strong>{User?.aadharAddress?.state}</strong>
                                </span>
                                <br />
                                <span className="aadhar-info_">
                                  Street :{" "}
                                  <strong>{User?.aadharAddress?.street}</strong>
                                </span>
                                <span className="aadhar-info_">
                                  Sub Dist :{" "}
                                  <strong>
                                    {User?.aadharAddress?.subdist}
                                  </strong>
                                </span>
                                <span className="aadhar-info_">
                                  Vtc :{" "}
                                  <strong>{User?.aadharAddress?.vtc}</strong>
                                </span>
                              </>
                            ) : (
                              "-"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
          <ul className="pagination d-flex justify-content-center">
            <Stack spacing={2}>
              <Pagination
                count={totalPages}
                color="secondary"
                page={currentPage}
                onChange={handlePageChange}
              />
            </Stack>
          </ul>
        </main>
      </div>
    </>
  );
};

export default NewRegisterUsers;
