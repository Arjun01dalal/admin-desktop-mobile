import { useEffect, useState } from "react";

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  Pagination,
  Stack,
  Switch,
  TextField,
} from "@mui/material";

import Sidenav from "../../../../Components/SideNavigation/SideNavigation";
import Breadcrumbs from "../../../../Components/Breadcrumbs/Breadcrumbs";
import Stateful_Select from "../../../../Components/Dropdown/Dropdown";
import { formatDate, formatedTime } from "../../../../utils/utility";
import { API_Endpoint } from "../../../../Configuration/Settings";
import SearchBar from "../../../../Components/SearchBox/Search";
import { decryptData } from "../../../../utils/decryptData";
import { encryptData } from "../../../../utils/encryptData";
import { API_Handler } from "../../../../API/API_Handler";

const BetConstructGames = () => {
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [shownPopup, setShownPopup] = useState(false);
  const [url, setUrl] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [loader, setLoader] = useState(false);
  const [pageNo, setPageNo] = useState(1);
  const [name, setName] = useState("");
  const [count, setCount] = useState(0);
  const [data, setData] = useState([]);

  const getBetConstructGames = async () => {
    const payload: any = {
      pageNo: pageNo,
      itemPerPage: itemsPerPage,
      status: true,
    };
    if (name) {
      payload.Name = name;
    }

    let token = localStorage.getItem("token");
    let config = {
      method: "post",
      url: `${API_Endpoint}/BetConstruct/get-all-games`,
      maxBodyLength: Infinity,
      data: { token: encryptData(payload) },
      headers: { Authorization: `Bearer ${token}` },
    };
    setLoader(true);
    await API_Handler.request(config)
      .then(async (response) => {
        const res = await decryptData(response?.data?.data);
        console.log("response?.data?.data:::11", res);
        setData(res?.payload?.games);
        setCount(res?.payload?.count);
      })
      .catch((error) => {
        console.log(error);
      })
      .finally(() => {
        setLoader(false);
      });
  };

  const handleImgUpload = async () => {
    const payload: any = {
      gameId: selectedId,
      url: url,
    };

    if(!url) {
      alert("Please add image Url.");
      return;
    }
    if(!selectedId) {
      alert("Please select proper image.");
      return;
    }    
    let token = localStorage.getItem("token");
    let config = {
      method: "post",
      url: `${API_Endpoint}/BetConstruct/Update-game-image`,
      maxBodyLength: Infinity,
      data: { token: encryptData(payload) },
      headers: { Authorization: `Bearer ${token}` },
    };
    await API_Handler.request(config)
      .then(async (response) => {
        getBetConstructGames();
      })
      .catch((error) => {
        console.log(error);
      })
      .finally(() => {
        setShownPopup(false);
        setSelectedId("");
        setLoader(false);
        setUrl("");
      });
  };
  useEffect(() => {
    getBetConstructGames();
  }, []);

  return (
    <div className="g-sidenav-show  bg-gray-100">
      <Sidenav />
      <main className="main-content position-relative">
        <div style={{ background: "#f8f9fa" }}>
          <Breadcrumbs tab={"Bet Construct Games"} />
        </div>

        <div className="container-fluid py-1" style={{ background: "#f8f9fa" }}>
          <div className="row">
            <div className="row tp-form mb-2">
              <div className="col-6 col-xl-2 col-sm-4 pdrt">
                <label className="lbl">Items Per Page</label>
                <div className="mt-1">
                  <Stateful_Select
                    value={itemsPerPage.toString()}
                    onChange={(newValue: any) => setItemsPerPage(newValue)}
                    options={["10", "25", "50", "75", "100", "500"]}
                    className="deposit-select"
                  />
                </div>
              </div>
              <div className="col-6 col-xl-2 col-sm-4 pdrt">
                <label className="lbl"></label>
                <a onClick={getBetConstructGames} className="sechBtn mt-1">
                  Apply
                </a>
              </div>
            </div>
          </div>
          <div className="col-6 col-xl-2 col-sm-4 pdrt mt-2">
            <span style={{ fontWeight: "bold" }}>Total Count:- {count}</span>
          </div>
        </div>
        <div className="col-12 mt-4">
          <div className="table-responsive">
            <table className="table table-view">
              <thead>
                <tr>
                  <th className="thdr"></th>
                  <th className="thdr">Name</th>
                  <th className="thdr">Category</th>
                  <th className="thdr">Allowed Currency</th>
                  <th className="thdr">Sub Category</th>
                  <th className="thdr">Game Id</th>
                  <th className="thdr">Provider Name</th>
                  <th className="thdr">Provider Details</th>
                  <th className="thdr">Rating</th>
                  <th className="thdr">Rating Count</th>
                  <th className="thdr">Status</th>
                  <th className="thdr">Images</th>
                  <th className="thdr">Updated On</th>
                </tr>
              </thead>
              <thead>
                <tr className="bg-table">
                  <th className="thdr"></th>
                  <th className="thdr">
                    <div className="justify-content-center">
                      <SearchBar
                        value={name}
                        onChange={(e: any) => setName(e?.target?.value)}
                        onSearch={getBetConstructGames}
                        placeholder="Search by Game name"
                      />
                    </div>
                  </th>
                  <th className="thdr"></th>
                  <th className="thdr"></th>
                  <th className="thdr"></th>
                  <th className="thdr"></th>
                  <th className="thdr"></th>
                  <th className="thdr"></th>
                  <th className="thdr"></th>
                  <th className="thdr"></th>
                  <th className="thdr"></th>
                  <th className="thdr"></th>
                  <th className="thdr"></th>
                </tr>
              </thead>

              <tbody>
                {data?.map((item: any, index: number) => {
                  return (
                    <>
                      <tr>
                        <td>
                          {index +
                            1 +
                            (pageNo && itemsPerPage
                              ? (pageNo - 1) * itemsPerPage
                              : 0)}
                        </td>
                        <td>{item?.Name}</td>
                        <td>{item?.category || "-"}</td>
                        <td>
                          {item?.allowedCurrency
                            ?.map((cur: any) => cur)
                            .join(", ") || "-"}
                        </td>
                        <td>{item?.subCategory || "-"}</td>
                        <td>{item?.gameId}</td>
                        <td>{item?.providerName}</td>
                        <td>
                          <div
                            style={{ display: "flex", flexDirection: "column" }}
                          >
                            <span>Name:- {item?.provider?.name}</span>
                            <span>ID:- {item?.provider?.id}</span>
                          </div>
                        </td>
                        <td>{item?.rating}</td>
                        <td>{item?.ratingCount}</td>
                        <td>
                          <Switch
                            id={item.gameId}
                            checked={item?.status}
                            color="primary"
                            //onChange={(e) => setActive(e.target.checked)}
                            //  onChange={(e) => handleSwitchChange(e)}
                          />
                        </td>
                        <td>
                          <div
                            style={{ flexDirection: "column", display: "flex" }}
                          >
                            <img
                              className="image-casino"
                              src={item?.images?.[2]?.url ?? ""}
                            ></img>
                            <Button
                              onClick={() => {
                                setSelectedId(item?.gameId);
                                setShownPopup(true);
                              }}
                              variant="contained"
                              style={{
                                marginTop: 5,
                                marginLeft: 0,
                                background: "#f1a144",
                                color: "#000",
                                fontSize: 10,
                              }}
                            >
                              Upload
                            </Button>
                          </div>
                        </td>
                        <td>{`${formatDate(item?.updatedOn)}-${formatedTime(item?.updatedOn)}`}</td>
                      </tr>
                    </>
                  );
                })}
              </tbody>
            </table>
            <ul className="pagination  justify-content-center">
              <Stack spacing={2}>
                <Pagination
                  count={Math.ceil(count / itemsPerPage)}
                  color="secondary"
                  page={pageNo}
                  onChange={(Event, New_Page) => setPageNo(New_Page)}
                />
              </Stack>
            </ul>
          </div>
        </div>
      </main>
      <div>
        <Dialog open={shownPopup} onClose={() => setShownPopup(false)}>
          <DialogContent className="flow-off">
            <h6>Add Img URL</h6>
            <div className="parent-container">
              <div className="centered-div">
                <div className="mt-1 text-inp">
                  <label>Img Url</label>
                  <TextField
                    variant="outlined"
                    size="small"
                    value={url}
                    onChange={(e: any) => setUrl(e.target.value)}
                    type={"text"}
                    fullWidth={true}
                  />
                </div>
              </div>
            </div>
            <DialogActions>
              <Button
                className="btn-popup"
                variant="outlined"
                onClick={() => setShownPopup(false)}
                color="primary"
              >
                Cancel
              </Button>
              <Button
                className="btn-popup"
                variant="outlined"
                type="submit"
                onClick={() => handleImgUpload()}
                //color="primary"
              >
                Submit
              </Button>
            </DialogActions>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default BetConstructGames;
