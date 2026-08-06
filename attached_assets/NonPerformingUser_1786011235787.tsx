import React, {
  useState,
  useEffect,
  useContext,
  ChangeEvent,
  FormEvent,
} from "react";
import Sidenav from "../SideNavigation/SideNavigation";
import Breadcrumbs from "../Breadcrumbs/Breadcrumbs";
import { API_Endpoint } from "../../Configuration/Settings";
import { encryptData } from "../../utils/encryptData";
import { User_Context } from "../../Contexts/User";
import axios from "axios";
import { decryptData } from "../../utils/decryptData";
import { useLocation } from "react-router-dom";
import { formatedTime } from "../../utils/utility";
import { formatDate } from "../../utils/utility";
import {
  Pagination,
  Select,
  SelectChangeEvent,
  Stack,
  MenuItem,
  TextField,
} from "@mui/material";
import Stateful_Select from "../Dropdown/Dropdown";
import IconButton from "@mui/material/IconButton";
import SearchIcon from "@mui/icons-material/Search";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import VisibilityIcon from "@mui/icons-material/Visibility";
import "./NonPerforming.css";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Loader from "../Loader/Loader";
import { Client_Names, Responsibilities } from "../../Configuration/Enums";
import InputLabel from "@mui/material/InputLabel";
import FormControl from "@mui/material/FormControl";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@material-ui/core";
import { API_Handler } from "../../API/API_Handler";

interface Pldata {
  _id: string;
  name: string;
  balance: number;
  createdOn: string;
  email: string;
  mobile: string;
  updatedOn: string;
  state: string;
  city: string;
  totalAmount: number;
  updatedAppVersion: string;
  currentAppVersion: string;
  clientName: string;
  nonPerformingComments?: any[];
  comments?: any[];
}

function NonPerformingUser() {
  const { User } = useContext(User_Context);
  const location = useLocation();
  const customProps = location.state;
  const [performingUser, setNonPerformingUser] = useState<Pldata[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<string>("10");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [totalUser, setTotalUser] = useState<number>(0);
  const [searchName, setSearchName] = useState<string>("");
  const [searchMobile, setSearchMobile] = useState<string>("");
  const [searchState, setSearchState] = useState<string>("");
  const [searchCity, setSearchCity] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [searchBalance, setSearchBalance] = useState("");
  const handlePerPage = (newValue: any) => {
    setItemsPerPage(newValue);
  };
  const [searchDpId, setSearchDpId] = useState("");

  const [appClientName, setAppClientName] = useState("");
  const [openCommentPopup, setOpenCommentPopup] = useState(false);
  const [openViewCommentsPopup, setOpenViewCommentsPopup] = useState(false);
  const [viewComments, setViewComments] = useState<any[]>([]);
  const [viewCommentsUserName, setViewCommentsUserName] = useState("");
  const [commentInput, setCommentInput] = useState("");
  const [commenterId, setCommenterId] = useState("");

  const Handle_App_Client_Name = (event: SelectChangeEvent<string>) => {
    setAppClientName(event.target.value);
  };

  const fetchNonPerformingUsers = () => {
    setLoading(true);

    const filter: {
      state?: string;
      mobile?: string;
      name?: string;
      city?: string;
      balance?: number;
      clientName?: string;
      _id?: string;
    } = {};

    if (searchName) filter.name = searchName;
    if (searchDpId) filter._id = searchDpId;
    if (searchMobile) filter.mobile = searchMobile;
    if (searchState) filter.state = searchState;
    if (searchCity) filter.city = searchCity;
    if (searchBalance) filter.balance = parseInt(searchBalance);
    if (appClientName) filter.clientName = appClientName;

    const data: any = {
      pageNo: currentPage,
      itemPerPage: parseInt(itemsPerPage),
      filter,
    };

    if (startDate && endDate) {
      data.startDate = startDate;
      data.endDate = endDate;
    }

    const config = {
      method: "post",
      maxBodyLength: Infinity,
      url: `${API_Endpoint}/User/nonPerformingUser`,
      headers: {
        Authorization: `Bearer ${User.token}`,
      },
      data: { token: encryptData(data) },
    };

    return axios
      .request(config)
      .then(async (response) => {
        const decrypted = await decryptData(response.data.data);
        const items = decrypted?.payload?.items ?? [];
        const states =
          User?.data?.accessibleStates?.map((s: string) => s.toLowerCase()) ??
          [];

        const filteredItems =
          states.length === 0
            ? items
            : items.filter((item: any) =>
                states.includes(item?.state?.toLowerCase()),
              );
              
        setNonPerformingUser(filteredItems);
        setTotalPages(decrypted?.payload?.totalPages ?? 1);
        setTotalUser(decrypted?.payload?.total ?? filteredItems.length);
        setLoading(false);
      })
      .catch((error: any) => {
        console.log(error.message);
        toast.error(error?.response?.data?.message || error.message);
        setLoading(false);
      });
  };

  const getData = () => fetchNonPerformingUsers();
  const onSearch = () => fetchNonPerformingUsers();

  const today = new Date();
  const oneWeekBefore = new Date(today);
  oneWeekBefore.setDate(today.getDate() - 7);

  const handleSearchName = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchName(event.target.value);
  };

  const handleSearchDpId = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchDpId(event.target.value);
  };

  const handleSearchMobile = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchMobile(event.target.value);
  };

  const handleSearchState = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchState(event.target.value);
  };

  const handleSearchCity = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchCity(event.target.value);
  };
  const handleSearchBalance = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchBalance(event.target.value);
  };

  useEffect(() => {
    fetchNonPerformingUsers();
  }, [currentPage, itemsPerPage, appClientName]);

  // copty mobile
  const copyMobile = async (textToCopy: any) => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      toast.success(`${textToCopy} Coppied`);
    } catch (err) {
      console.log(err);
    }
  };

  const getUserNonPerformingComments = (userRow: any) => {
    const comments =
      userRow?.nonPerformingComments ||
      userRow?.nonPerformingComment ||
      userRow?.newRegistrationComments ||
      userRow?.comments ||
      [];
    return Array.isArray(comments) ? comments : [];
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
    const submittedComment = commentInput.trim();
    const submittedUserId = commenterId;
    const newComment = {
      comment: submittedComment,
      who: {
        userId: User.data._id,
        userName: User.data.name,
      },
      date: new Date().toISOString(),
    };

    setLoading(true);
    const data = {
      _id: submittedUserId,
      comment: submittedComment,
      who: {
        userId: User.data._id,
        userName: User.data.name,
      },
    };
    const config = {
      method: "post",
      maxBodyLength: Infinity,
      url: `${API_Endpoint}/User/add-non-performing-comment`,
      headers: {
        Authorization: `Bearer ${User.token}`,
      },
      data: { token: encryptData(data) },
    };
    API_Handler.request(config)
      .then(async () => {
        // Instant UI update
        setNonPerformingUser((prev) =>
          prev.map((u) => {
            if (u._id !== submittedUserId) return u;
            return {
              ...u,
              nonPerformingComments: [
                ...getUserNonPerformingComments(u),
                newComment,
              ],
            };
          }),
        );
        setOpenCommentPopup(false);
        setCommenterId("");
        toast.success("Comment added successfully");

        // Refetch and merge so new comment is not wiped by stale API data
        try {
          await fetchNonPerformingUsers();
          setNonPerformingUser((prev) =>
            prev.map((u) => {
              if (u._id !== submittedUserId) return u;
              const logs = getUserNonPerformingComments(u);
              const alreadyExists = logs.some(
                (c: any) =>
                  c?.comment === submittedComment &&
                  String(c?.who?.userId) === String(User.data._id),
              );
              if (alreadyExists) return u;
              return {
                ...u,
                nonPerformingComments: [...logs, newComment],
              };
            }),
          );
        } catch (err) {
          console.log(err);
        } finally {
          setLoading(false);
        }
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
    setViewComments(getUserNonPerformingComments(userRow));
    setViewCommentsUserName(userRow?.name || "");
    setOpenViewCommentsPopup(true);
  };

  return (
    <>
      {loading && <Loader />}
      <ToastContainer autoClose={2000} position="top-center" />
      <div className="g-sidenav-show  bg-gray-100">
        <Sidenav />
        <main className="main-content position-relative">
          <div>
            <Dialog
              open={openCommentPopup}
              onClose={() => {
                setOpenCommentPopup(false);
                setCommentInput("");
              }}
              maxWidth="sm"
              fullWidth
              className="np-add-comment-modal"
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
              className="np-comments-modal"
            >
              <DialogTitle>
                Comments
                {viewCommentsUserName ? ` — ${viewCommentsUserName}` : ""}
              </DialogTitle>
              <DialogContent>
                {viewComments.length > 0 ? (
                  <div className="np-comments-list">
                    {viewComments.map((item: any, index: number) => {
                      const commentDate =
                        item?.date || item?.createdOn || item?.createdAt;
                      return (
                        <div className="np-comment-card" key={index}>
                          <p className="np-comment-card__text">
                            {item?.comment || "-"}
                          </p>
                          <div className="np-comment-card__meta">
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
                  <div className="np-comments-empty">No Comments</div>
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
          </div>
          <div style={{ background: "#f8f9fa" }}>
            <Breadcrumbs tab={"User Data"} />
            <div className="container-fluid">
              <div className="row">
                <div className="row tp-form">
                  <div className="col-6 col-xl-2 col-sm-4 pdrt">
                    <label className="lbl">From Date</label>
                    <input
                      type="date"
                      className="form-control"
                      placeholder="From Date"
                      value={startDate}
                      max={oneWeekBefore.toISOString().split("T")[0]}
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
                      max={oneWeekBefore.toISOString().split("T")[0]}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                  <div className="col-6 col-xl-2 col-sm-4 pdrt">
                    <label className="lbl"></label>
                    <a onClick={getData} className="sechBtn mt-1">
                      Apply
                    </a>
                  </div>
                  <div className="col-6 col-xl-2 col-sm-4 pdrt btn-top role-mob role-web mt-1">
                    <label className="lbl">Items Per Page</label>
                    <Stateful_Select
                      // label="Items Per Page"
                      value={itemsPerPage.toString()}
                      onChange={(newValue: any) => handlePerPage(newValue)}
                      options={["10", "25", "50", "75", "100"]}
                    />
                  </div>
                </div>
                <div className="row">
                  <div className="row tp-form mb-1" style={{ display: "flex" }}>
                    <div className="align-items-center mt-2 mb-2">
                      <label className="lbl"></label>
                      <b>Total user count : {totalUser}</b>
                    </div>
                  </div>
                </div>
                <div className="col-12">
                  <div className="table-responsive">
                    <table className="table table-view">
                      <thead>
                        <tr>
                          <th className="text-center">#</th>
                          <th className="text-center">
                            User <br /> Name
                          </th>
                          <th className="text-center">Dp ID</th>
                          <th className="text-center">
                            App <br /> Name
                          </th>
                          <th className="text-center">Email</th>
                          <th className="text-center">
                            Mobile <br /> No
                          </th>
                          <th className="text-center">Balance</th>
                          <th className="text-center">
                            Deposit <br /> Amount
                          </th>
                          <th className="text-center">State</th>
                          <th className="text-center">City</th>
                          <th className="text-center">
                            Current App <br /> Version
                          </th>
                          <th className="text-center">
                            Updated App <br /> Version
                          </th>
                          <th className="text-center">Created</th>
                          <th className="text-center">
                            last <br /> Activity
                          </th>
                          <th className="text-center">
                            Add <br /> Comment
                          </th>
                        </tr>
                      </thead>
                      <thead>
                        <tr>
                          <th className="thdr"></th>
                          <th className="thdr">
                            <div>
                              <input
                                value={searchName}
                                onChange={handleSearchName}
                                placeholder=" Search user name"
                              />
                              <IconButton
                                onClick={onSearch}
                                type="button"
                                sx={{ p: "10px 0px" }}
                                aria-label="search"
                                className="icon-button1"
                              >
                                <SearchIcon />
                              </IconButton>
                            </div>
                          </th>
                          <th className="thdr">
                            <div>
                              <input
                                value={searchDpId}
                                onChange={handleSearchDpId}
                                placeholder=" Search Dp Id"
                              />
                              <IconButton
                                onClick={onSearch}
                                type="button"
                                sx={{ p: "10px 0px" }}
                                aria-label="search"
                                className="icon-button1"
                              >
                                <SearchIcon />
                              </IconButton>
                            </div>
                          </th>
                          <th className="thdr">
                            <Select
                              labelId="demo-select-small-label"
                              id="demo-select-small"
                              label="Select App Name"
                              value={appClientName}
                              onChange={Handle_App_Client_Name}
                              sx={{ height: "30px" }}
                            >
                              {Client_Names?.map(
                                (appName: any, index: number) => (
                                  <MenuItem key={index} value={appName}>
                                    {appName}
                                  </MenuItem>
                                )
                              )}
                            </Select>
                          </th>
                          <th className="thdr"></th>
                          <th className="thdr">
                            <div>
                              <input
                                value={searchMobile}
                                onChange={handleSearchMobile}
                                placeholder=" Search user mobile"
                              />
                              <IconButton
                                onClick={onSearch}
                                type="button"
                                sx={{ p: "10px 0px" }}
                                aria-label="search"
                                className="icon-button1"
                              >
                                <SearchIcon />
                              </IconButton>
                            </div>
                          </th>
                          <th className="thdr">
                            <div>
                              <input
                                value={searchBalance}
                                onChange={handleSearchBalance}
                                placeholder=" Search user balance"
                              />
                              <IconButton
                                onClick={onSearch}
                                type="button"
                                sx={{ p: "10px 0px" }}
                                aria-label="search"
                                className="icon-button1"
                              >
                                <SearchIcon />
                              </IconButton>
                            </div>
                          </th>
                          <th className="thdr"></th>
                          <th className="thdr">
                            <div>
                              <input
                                value={searchState}
                                onChange={handleSearchState}
                                placeholder=" Search user state"
                              />
                              <IconButton
                                onClick={onSearch}
                                type="button"
                                sx={{ p: "10px 0px" }}
                                aria-label="search"
                                className="icon-button1"
                              >
                                <SearchIcon />
                              </IconButton>
                            </div>
                          </th>
                          <th className="thdr">
                            <div>
                              <input
                                value={searchCity}
                                onChange={handleSearchCity}
                                placeholder=" Search user city"
                              />
                              <IconButton
                                onClick={onSearch}
                                type="button"
                                sx={{ p: "10px 0px" }}
                                aria-label="search"
                                className="icon-button1"
                              >
                                <SearchIcon />
                              </IconButton>
                            </div>
                          </th>
                          <th className="thdr"></th>
                          <th className="thdr"></th>
                          <th className="thdr"></th>
                          <th className="thdr"></th>
                          <th className="thdr"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {performingUser?.map((item, index) => (
                          <tr id={item._id}>
                            <td>
                              {index +
                                1 +
                                (currentPage && itemsPerPage
                                  ? (currentPage - 1) * parseInt(itemsPerPage)
                                  : 0)}
                            </td>
                            <td
                              onClick={() => {
                                const url = `/user-report/${item._id}/${item.name}`;
                                window.open(url, "_blank");
                              }}
                              style={{ cursor: "pointer" }}
                            >
                              {item?.name}
                            </td>
                            <td>
                              {item?._id}
                              <ContentCopyIcon
                                onClick={() => copyMobile(item?._id)}
                                style={{
                                  color: "#333",
                                  fontSize: "17px",
                                  marginLeft: "10px",
                                  cursor: "pointer",
                                }}
                              />
                            </td>
                            <td>{item?.clientName}</td>
                            <td>{item?.email}</td>
                            <td>
                              {User?.data?.Responsibilities?.includes(
                                Responsibilities?.show_mobile
                              ) ? (
                                <>
                                  {item?.mobile}
                                  <ContentCopyIcon
                                    onClick={() => copyMobile(item?.mobile)}
                                    style={{
                                      color: "#333",
                                      fontSize: "17px",
                                      marginLeft: "10px",
                                      cursor: "pointer",
                                    }}
                                  />
                                </>
                              ) : (
                                `**********`
                              )}
                            </td>
                            <td>{Math.round(item.balance)}</td>
                            <td>{Math.round(item.totalAmount ?? 0)}</td>
                            <td>{item.state}</td>
                            <td>{item.city}</td>
                            <td>{item.currentAppVersion}</td>
                            <td>{item.updatedAppVersion}</td>
                            <td>
                              {item.createdOn
                                ? `${formatDate(item.createdOn)} ${formatedTime(
                                    item.createdOn
                                  )}`
                                : ""}
                            </td>
                            <td>
                              {item.updatedOn
                                ? `${formatDate(item.updatedOn)} ${formatedTime(
                                    item.updatedOn
                                  )}`
                                : ""}
                            </td>
                            <td>
                              {(() => {
                                const commentsCount =
                                  getUserNonPerformingComments(item).length;
                                return (
                                  <div className="np-comment-actions">
                                    <button
                                      onClick={() =>
                                        handleAddCommentClick(item?._id)
                                      }
                                      className="np-comment-btn"
                                      type="button"
                                    >
                                      <ChatBubbleOutlineIcon
                                        style={{ fontSize: 15 }}
                                      />
                                      Comment
                                    </button>
                                    <button
                                      className="np-view-all-btn"
                                      type="button"
                                      onClick={() =>
                                        handleViewAllComment(item)
                                      }
                                    >
                                      <VisibilityIcon
                                        style={{ fontSize: 15 }}
                                      />
                                      View All
                                      {commentsCount > 0
                                        ? ` (${commentsCount})`
                                        : ""}
                                    </button>
                                  </div>
                                );
                              })()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <ul className="pagination d-flex justify-content-center">
                    <Stack spacing={2}>
                      <Pagination
                        count={totalPages}
                        color="secondary"
                        page={currentPage}
                        onChange={(Event, New_Page) => setCurrentPage(New_Page)}
                      />
                    </Stack>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

export default NonPerformingUser;
