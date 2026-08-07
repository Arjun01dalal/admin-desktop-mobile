import React, { ChangeEvent, FormEvent, useContext, useEffect, useState } from 'react'
import Sidenav from '../../../../Components/SideNavigation/SideNavigation'
import "./Roles_and_Responsibilities.css"
import Radio from '@mui/material/Radio';
import Breadcrumbs from '../../../../Components/Breadcrumbs/Breadcrumbs'
import { Button, Checkbox, Pagination, Stack, TextField,FormControl, FormControlLabel, FormLabel, RadioGroup, } from '@mui/material'
import { useLocation, useNavigate } from 'react-router-dom'
import IconButton from "@mui/material/IconButton";
import SearchIcon from "@mui/icons-material/Search";
import { method } from 'lodash'
import { url } from 'inspector'
import { API_Endpoint } from '../../../../Configuration/Settings'
import { encryptData } from '../../../../utils/encryptData'
import { User_Context } from '../../../../Contexts/User'
import axios from 'axios'
import { decryptData } from '../../../../utils/decryptData'
import Stateful_Select from '../../../../Components/Dropdown/Dropdown'
import { table } from 'console'
import { formatDate, formatedTime } from '../../../../utils/utility'
import Loader from '../../../../Components/Loader/Loader'
import { toast } from 'react-toastify'
import { Dialog, DialogActions, DialogContent, DialogTitle } from "@material-ui/core";
import { Edit } from '@mui/icons-material'
import { API_Handler } from '../../../../API/API_Handler'
import { Client_Names } from '../../../../Configuration/Enums';

const Add_Roles_And_Responsibilities = () => {
    const [checkedItems, setCheckedItems] = useState<{ [key: number]: boolean }>({});
    const location = useLocation()
    const navigate = useNavigate();
    const [searchName, setSearchName] = useState<string>("");
    const [searchMob, setSearchMob] = useState<string>("");
    const [searchCity, setSearchCity] = useState<string>("");
    const [searchState, setSearchState] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const { User } = useContext(User_Context);
    const [tableData, setTableData] = useState([]);
    const [totalPages, setTotalPages] = useState(1);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState<number>(20);
    const [loader, setLoader] = useState(false);
    const [blockRoleID, setBlockRoleId] = useState("");
    const [blockUserId, setBlockUserId] = useState("");
    const [openPopup, setOpenPopup] = useState<boolean>(false);
    const [blockUser, setBlockUser] = useState<boolean>();
    const [remark, setRemark] = useState<string>("");
    const [tracingCheckedUser, setTracingCheckedUser] = useState("");
    const [openCoinUpdateModal, setOpenCoinUpdateModal] = useState(false);
    const [inputCoin, setInputCoin] = useState("");
    const [coinUpdatingUserId, setCoinUpdatingUserId] = useState("");
     const [openEditeAppPopup, setOpenEditeAppPopup] = useState(false)
        const [selectedUserId, setSelectedUserId] = useState<string>(''); // NEW - for app operations
        const [selectedApp, setSelectedApp] = useState('');
        const [openRemoveAppPopup, setOpenRemoveAppPopup] = useState(false);
        const [selectedRemoveApp, setSelectedRemoveApp] = useState('');
        const [userApps, setUserApps] = useState<string[]>([]);

    // State to track whether a checkbox with showCoins true or false was selected
    const [selectedType, setSelectedType] = useState<"true" | "false" | null>(null);

    // handle page change
    const handlePerPage = (newValue: any) => {
        const perPage = parseInt(newValue, 10);
        setItemsPerPage(perPage);
    }

    // handle filtering data fileds data
    const handleSearchName = (event: ChangeEvent<HTMLInputElement>) => {
        setSearchName(event.target.value);
    };

    const handleSearchMob = (event: ChangeEvent<HTMLInputElement>) => {
        setSearchMob(event.target.value);
    };

    const handleSearchCity = (event: ChangeEvent<HTMLInputElement>) => {
        setSearchCity(event.target.value);
    };

    const handleSearchState = (event: ChangeEvent<HTMLInputElement>) => {
        setSearchState(event.target.value);
    };


    const handleRemark = (e: ChangeEvent<HTMLInputElement>) => {
        setRemark(e.target.value);
    };
    const handleInputCoin = (e: ChangeEvent<HTMLInputElement>) => {
        setInputCoin(e.target.value)
    }


    const handleActionSubmit = (e: FormEvent) => {
        e.preventDefault()
        if (!remark) {
            toast.error("Please enter remark")
        } else {
            setOpenPopup(false);
            setLoading(true);
            let data = {
                _id: blockUserId,
                Role_ID: blockRoleID,
                status: blockUser,
                blockReason: remark
            }
            let config = {
                method: "post",
                maxBodyLength: Infinity,
                url: `${API_Endpoint}/SubAdmin/block-caller`,
                headers: {
                    Authorization: `Bearer ${User.token}`,
                },
                data: { token: encryptData(data) },
            };
            axios
                .request(config)
                .then(() => {
                    setLoading(false);
                    getSubAdmins();
                    setRemark("");
                    setBlockRoleId("")
                    setBlockUserId("")
                })
                .catch((error: any) => {
                    setLoading(false)
                    toast.error(error.response.data.message)
                });
        }
    }


    const getSubAdmins = async () => {
        setLoader(true);
        let data = {
            itemPerPage: itemsPerPage,
            pageNo: currentPage
        };

        let config = {
            method: "post",
            maxBodyLength: Infinity,
            url: `${API_Endpoint}/SubAdmin/get-all-subadmins`,
            headers:
            {
                Authorization: `Bearer ${User.token}`,
            },
            data: { token: encryptData(data) }
        }

        API_Handler.request(config)
            .then(async(response) => {
                setLoader(false);
                response.data.data =await decryptData(response.data.data);
                setTableData(response.data.data.payload.items);
                setTotalPages(response.data.data.payload.totalPages)
            })
            .catch((error) => {
                setLoader(false);
                console.log(error)
            })

    }



    // on filtering the users
    const onSearch = () => {
        setLoader(true);
        let filter: { [key: string]: string | number };
        filter = {}
        if (searchName) {
            filter["name"] = searchName;
        }
        if (searchMob) {
            filter["mobile"] = searchMob;
        }

        let data = {
            filter: filter,
            itemPerPage: itemsPerPage,
            pageNo: currentPage
        };

        let config = {
            method: "post",
            maxBodyLength: Infinity,
            url: `${API_Endpoint}/SubAdmin/get-all-subadmins`,
            headers:
            {
                Authorization: `Bearer ${User.token}`,
            },
            data: { token: encryptData(data) }
        }

        API_Handler.request(config)
            .then(async(response) => {
                setLoader(false);
                response.data.data = await decryptData(response.data.data);

                setTableData(response.data.data.payload.items);
                setTotalPages(response.data.data.payload.totalPages)
            })
            .catch((error) => {
                console.log(error)
            })

    }


    useEffect(() => {
        getSubAdmins();
    }, [currentPage, itemsPerPage])



    // handle submit add responsblity
    const handleSubmitResponsbility = ({ type = '', id = '', once = false } = {}) => {

        if (once === false && Object.keys(checkedItems).length === 0) {
            toast.error("please select user you want to addd");
            return;
        }

        let data = {
            _id: once ? [id] : Object.keys(checkedItems),
            type: once ? type : tracingCheckedUser
        };
        let config = {
            method: "post",
            maxBodyLength: Infinity,
            url: `${API_Endpoint}/SubAdmin/update-coin-roles`,
            headers:
            {
                Authorization: `Bearer ${User.token}`,
            },
            data: { token: encryptData(data) }
        }
        console.log(data)
        API_Handler.request(config)
            .then(async(response) => {
                response.data.data = await decryptData(response.data.data);
                getSubAdmins();
                setSelectedType(null);
                // Uncheck all items by setting all values to false
                Object.keys(checkedItems)?.forEach((key: any) => delete checkedItems[key])
            })
            .catch((error) => {
                console.log(error);
            })


    }

    // on user select user which give responsibility
    // const handleCheckbox = (id: number) => (event: React.ChangeEvent<HTMLInputElement>) => {
    //     setCheckedItems(prevState => ({
    //         ...prevState,
    //         [id]: event.target.checked,
    //     }));
    // };

    // on user select user which give responsibility
    const handleCheckbox = (id: number, type: string) => (event: React.ChangeEvent<HTMLInputElement>) => {

        const isChecked = event.target.checked;
        // Update the state to reflect the checkbox change
        setCheckedItems(prevState => {
            const updatedItems = { ...prevState };
            if (isChecked) {
                setTracingCheckedUser(type)
                const item: any = tableData?.find((item: any) => item._id === id);
                setSelectedType(item?.showCoins ? "true" : "false");
                // Add the item to the checkedItems state
                updatedItems[id] = true;
            } else {
                // setSelectedType(null);
                // Remove the item from checkedItems state if unchecked
                delete updatedItems[id];
                setTracingCheckedUser("");

                if (Object.keys(updatedItems)?.length === 0) {
                    setSelectedType(null);
                }
            }

            return updatedItems;
        });
    };



    const handleBlockAction = (roleid: string, blockUser: boolean, _id: string) => {
        setBlockUserId(_id)
        setBlockRoleId(roleid);
        setBlockUser(blockUser)
        setOpenPopup(true);
    }

    useEffect(() => {
        console.log(checkedItems)
    }, [checkedItems]);


    const handleCoinUpdateAction = (e: FormEvent) => {
        e.preventDefault();
        let payload = {
            _id: coinUpdatingUserId,
            coin: inputCoin,
            coinUpdatedBy: {
                _id: User?.data?._id,
                name: User?.data?.name,
                coin: inputCoin
            }
        }
        console.log(payload)
        setLoader(true);
        let config = {
            method: "post",
            maxBodyLength: Infinity,
            url: `${API_Endpoint}/SubAdmin/add-coin`,
            headers:
            {
                Authorization: `Bearer ${User.token}`,
            },
            data: { token: encryptData(payload) }
        }
        API_Handler.request(config)
            .then(async(response) => {
                let API_Response = await decryptData(response.data.data);
                setOpenCoinUpdateModal(false);
                setInputCoin("")
                toast.success("Coin Limits is Updated");
                console.log(API_Response);
                setLoader(false);

            })
            .catch((error) => {
                console.log(error);
                setOpenCoinUpdateModal(false);
                setInputCoin("");
                toast.error(error?.response?.data?.message)
                setLoader(false);
            })
    }

    const handleCoinEditeClick = (_id: any) => {
        setCoinUpdatingUserId(_id);
        setOpenCoinUpdateModal(true);
    }

    // handle remove coin permission 
    const handleRemovePermission = async ({ item }: any) => {
        let token = localStorage.getItem("token");
        let payload = {
            _id: item?._id,
            status: !item?.showRemoveCoin
        }

        console.log(item)
        let config = {
            method: "post",
            maxBodyLength: Infinity,
            url: `${API_Endpoint}/SubAdmin/removeCoin`,
            data: { token: encryptData(payload) },
            headers: { Authorization: `Bearer ${token}` }
        }

        await API_Handler.request(config)
            .then(async(response) => {
                // let Api_Response = await decryptData(response.data.data);
                console.log(response);
                toast.success("Coin Permission Removed ");
                getSubAdmins();
            })
            .catch((error) => {
                console.log(error);
                toast.error(error?.response?.data?.error)
            })
    }
 const handleAddButtonClick = (item:any) => {
    setSelectedUserId(item._id); // Store the user ID
    setUserApps(item.allotedApps || []); // Store current apps to disable in Add dialog
    setSelectedApp(''); // Reset selection
    setOpenEditeAppPopup(true);
};

const handleRemoveButtonClick = (item:any) => {
    setSelectedUserId(item._id); // Store the user ID
    setUserApps(item.allotedApps || []); // Store current apps for Remove dialog
    setSelectedRemoveApp(''); // Reset selection
    setOpenRemoveAppPopup(true);
};

// Fixed API function - use cityEditerId instead of User.data._id
const handleAppOperation = (e: FormEvent, operationType: 'add' | 'remove') => {
    setLoading(true);
    e.preventDefault();
    
    const currentSelectedApp = operationType === 'add' ? selectedApp : selectedRemoveApp;
    
    if (!currentSelectedApp) {
        setLoading(false);
        console.log(`Please select an app to ${operationType}`);
        return;
    }
    
    let data = {
        userId: selectedUserId, // Use the stored user ID, not current logged-in user
        app: currentSelectedApp,
        type: operationType,
    }
    console.log("payload app---->", data);
    
    let config = {
        method: "post",
        maxBodyLength: Infinity,
        url: `${API_Endpoint}/SubAdmin/update-app-heads`,
        headers: {
            Authorization: `Bearer ${User.token}`,
        },
        data: { token: encryptData(data) },
    };
    
    API_Handler.request(config)
        .then((response) => {
            setLoading(false);
            console.log("response app--->", response);
            
            // Close the appropriate popup and reset states
            if (operationType === 'add') {
                setOpenEditeAppPopup(false);
                setSelectedApp("");
            } else {
                setOpenRemoveAppPopup(false);
                setSelectedRemoveApp("");
            }
            
            // Reset common states
            setUserApps([]);
            setSelectedUserId("");
            getSubAdmins(); // Refresh the data
        })
        .catch((error) => {
            setLoading(false);
            console.log(error);
        });
};

    return <>
        {loader && <Loader />}
        <Sidenav />

        <main className="main-content position-relative">
            <div>
                <Dialog open={openPopup} onClose={() => setOpenPopup(false)}>
                    <DialogContent>
                        <form onSubmit={handleActionSubmit}>
                            <div>
                                <TextField type={"text"} label={"Please enter remark"} fullWidth={true} value={remark} onChange={handleRemark} />
                            </div>
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
            </div>

            <div>
                <Dialog open={openCoinUpdateModal} onClose={() => setOpenCoinUpdateModal(false)}>
                    <DialogContent>
                        <form onSubmit={handleCoinUpdateAction}>
                            <div>
                                <TextField required type={"number"} label={"Please enter Coin"} fullWidth={true} value={inputCoin} onChange={handleInputCoin} />
                            </div>
                            <DialogActions>
                                <Button
                                    className="btn-popup"
                                    variant="outlined"
                                    onClick={() => setOpenCoinUpdateModal(false)}
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
            </div>
                                <div>
                <Dialog open={openEditeAppPopup} onClose={() => setOpenEditeAppPopup(false)}>
                    <DialogTitle>Select an App</DialogTitle>
                    <DialogContent>
                        <form onSubmit={(e) => handleAppOperation(e, 'add')}>
                            <FormControl component="fieldset" fullWidth>
                                <FormLabel component="legend">Choose one app:</FormLabel>
                                <RadioGroup
                                    value={selectedApp}
                                    onChange={(e) => setSelectedApp(e.target.value)}
                                    sx={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(4, 1fr)',
                                        gap: 1,
                                        mt: 1
                                    }}
                                >
                                    {Client_Names.map((appName: string) => {
                                        const isAlreadyAssigned = (userApps as string[]).includes(appName);
                                        return (
                                            <FormControlLabel
                                                key={appName}
                                                value={appName}
                                                control={<Radio />}
                                                label={appName}
                                                disabled={isAlreadyAssigned}
                                                sx={{ 
                                                    margin: 0,
                                                    opacity: isAlreadyAssigned ? 0.5 : 1,
                                                    '& .MuiFormControlLabel-label': {
                                                        textDecoration: isAlreadyAssigned ? 'line-through' : 'none',
                                                        color: isAlreadyAssigned ? '#999' : 'inherit'
                                                    }
                                                }}
                                            />
                                        );
                                    })}
                                </RadioGroup>
                            </FormControl>
                            <DialogActions>
                                <Button
                                    className="btn-popup"
                                    variant="outlined"
                                    onClick={() => {
                                        setOpenEditeAppPopup(false);
                                        setSelectedApp("");
                                        setUserApps([]);
                                        setSelectedUserId("");
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
                                    disabled={!selectedApp}
                                >
                                    Submit
                                </Button>
                            </DialogActions>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>
            
            <div>
                <Dialog open={openRemoveAppPopup} onClose={() => setOpenRemoveAppPopup(false)}>
                    <DialogTitle>Remove an App</DialogTitle>
                    <DialogContent>
                        <form onSubmit={(e) => handleAppOperation(e, 'remove')}>
                            <FormControl component="fieldset" fullWidth>
                                <FormLabel component="legend">Choose app to remove:</FormLabel>
                                {userApps && userApps.length > 0 ? (
                                    <RadioGroup
                                        value={selectedRemoveApp}
                                        onChange={(e) => setSelectedRemoveApp(e.target.value)}
                                        sx={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(4, 1fr)',
                                            gap: 1,
                                            mt: 1
                                        }}
                                    >
                                        {userApps.map((appName: string) => (
                                            <FormControlLabel
                                                key={appName}
                                                value={appName}
                                                control={<Radio />}
                                                label={appName}
                                                sx={{ margin: 0 }}
                                            />
                                        ))}
                                    </RadioGroup>
                                ) : (
                                    <p style={{ marginTop: '10px', color: '#666' }}>
                                        No apps assigned to this user.
                                    </p>
                                )}
                            </FormControl>
                            <DialogActions>
                                <Button
                                    className="btn-popup"
                                    variant="outlined"
                                    onClick={() => {
                                        setOpenRemoveAppPopup(false);
                                        setSelectedRemoveApp("");
                                        setUserApps([]);
                                        setSelectedUserId("");
                                    }}
                                    color="primary"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    className="btn-popup"
                                    variant="outlined"
                                    type="submit"
                                    color="error"
                                    disabled={!selectedRemoveApp || !userApps || userApps.length === 0}
                                >
                                    Remove
                                </Button>
                            </DialogActions>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>


            <div style={{ background: "#f8f9fa" }}>
                <Breadcrumbs tab={"Add Responsbility"} button={<Button
                    onClick={() => handleSubmitResponsbility({ type: "add", once: false })}
                    className="btn-payment"
                    variant="contained"
                >
                    Add
                </Button>} />

                <div className="container-fluid">
                    <div className="col-6 col-xl-2 col-sm-4 pdrt btn-top role-mob role-web mt-1">
                        <label className="lbl">Items Per Page</label>
                        <Stateful_Select
                            // label="Items Per Page"
                            value={itemsPerPage.toString()}
                            onChange={(newValue: any) => handlePerPage(newValue)}
                            options={["20", "25", "50", "75", "100"]}
                        />
                    </div>
                    <div className="row">
                        <div className="col-12 mt-2">
                            <div className="table-responsive">
                                <table className="table table-view">
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>Action</th>
                                            <th>Remove Coin <br/>Permission</th>
                                            <th>Name</th>
                                            <th>Mobile No</th>
                                            <th>Coins Limit</th>
                                            <th>Email </th>
                                            <th>Role Id</th>
                                            <th>Action</th>
                                            <th>Created On</th>
                                            <th>Last Activity</th>
                                            <th>Current Apps</th>
                                            <th>Edit Apps</th>
                                        </tr>
                                    </thead>
                                    <thead>
                                        <tr>
                                            <th className='thdr'></th>
                                            <th className='thdr'></th>
                                            <th className='thdr'></th>
                                            <th className='thdr'>
                                                <div className="">
                                                    <input value={searchName} onChange={handleSearchName} placeholder=" Search name" />
                                                    <IconButton
                                                        onClick={onSearch}
                                                        type="button"
                                                        sx={{ p: '10px 0px' }}
                                                        aria-label="search"
                                                        className='icon-button'
                                                    >
                                                        <SearchIcon />
                                                    </IconButton>
                                                </div>
                                            </th>
                                            <th className='thdr'>
                                                <div className=''>
                                                    <input value={searchMob} onChange={handleSearchMob} placeholder=" Search mob" />
                                                    <IconButton
                                                        onClick={onSearch}
                                                        type="button"
                                                        sx={{ p: '10px 0px' }}
                                                        aria-label="search"
                                                        className='icon-button'
                                                    >
                                                        <SearchIcon />
                                                    </IconButton>
                                                </div>
                                            </th>
                                            <th className='thdr'></th>
                                            <th className='thdr'></th>
                                            <th className='thdr'></th>
                                            <th className='thdr'></th>
                                            <th className='thdr'></th>
                                            <th className='thdr'></th>
                                            <th className='thdr'></th>
                                            <th className='thdr'></th>

                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tableData.map((item: any, index: number) => {
                                            return (
                                                <tr key={item._id} id={item._id}>
                                                    <td>{index + 1 + (currentPage && itemsPerPage ? (currentPage - 1) * itemsPerPage : 0)}</td>
                                                    <td>
                                                        {
                                                            !item?.hasOwnProperty("showCoins") &&
                                                            <Button
                                                                disabled={Object.keys(checkedItems).length > 0 ? true : false}
                                                                onClick={() => handleSubmitResponsbility({ type: "add", id: item?._id, once: true })}
                                                                className="btn-withdraw"
                                                                variant="contained"
                                                            >
                                                                Add
                                                            </Button>

                                                        }
                                                        {
                                                            item?.showCoins === false &&
                                                            <Button
                                                                disabled={Object.keys(checkedItems).length > 0 ? true : false}
                                                                onClick={() => handleSubmitResponsbility({ type: "add", id: item?._id, once: true })}
                                                                className="btn-withdraw"
                                                                variant="contained"
                                                            >
                                                                Add
                                                            </Button>
                                                        }
                                                        {
                                                            item?.showCoins === true &&
                                                            <Button
                                                                disabled={Object.keys(checkedItems).length > 0 ? true : false}
                                                                onClick={() => handleSubmitResponsbility({ type: "remove", id: item?._id, once: true })}
                                                                className="btn-withdraw"
                                                                variant="contained"
                                                            >
                                                                Remove
                                                            </Button>
                                                        }

                                                    </td>
                                                    <td>

                                                        <Button
                                                            onClick={() => handleRemovePermission({ item })}
                                                            className="btn-withdraw"
                                                            variant="contained">
                                                            {
                                                                item?.showRemoveCoin === true ? "Remove Permission" : "Add Permission"
                                                            }

                                                        </Button>

                                                    </td>
                                                    <td>
                                                        <Checkbox
                                                            checked={checkedItems[item._id] || false}
                                                            onChange={handleCheckbox(item._id, item?.showCoins === true ? "remove" : "add")}
                                                            color="primary"
                                                            key={item._id}
                                                            disabled={
                                                                // Disable checkboxes based on the selectedType state
                                                                selectedType === "true"
                                                                    ? item.showCoins === false
                                                                    : selectedType === "false"
                                                                        ? item.showCoins === true
                                                                        : false
                                                            }
                                                        />

                                                        {item.name}
                                                    </td>
                                                    <td>
                                                        {item.mobile}
                                                        <button onClick={() => handleCoinEditeClick(item?._id)} className='coin-edite-button_'><Edit className='mui-edite_' /></button>
                                                    </td>
                                                    <td>{item?.coinLimit}</td>
                                                    <td>{item?.email}</td>
                                                    <td>{item?.Role_ID}</td>
                                                    <td> <span>
                                                        <Button
                                                            id={item._id}
                                                            onClick={() => handleBlockAction(item.Role_ID, !item.block, item._id)}
                                                            className="btn-withdraw"
                                                            variant="contained">
                                                            {item.block === true ? "Un Block " : "Block"}
                                                        </Button>
                                                    </span></td>
                                                    <td>{`${formatDate(item.createdOn)} ${formatedTime(item.createdOn)}`}</td>
                                                    <td>{`${formatDate(item.updatedOn)} ${formatedTime(item.updatedOn)}`}</td>
                                                     <td>{item.allotedApps ? item.allotedApps.join(', ') : ''}</td>
                                                      <td> 
                                                      <span hidden={!["6a33c137a6558491e0d20464","64f710d9a2ab78980020c5fb"]?.includes(User.data.Role_ID)}>
                                                      <Button
                                                       onClick={() => handleAddButtonClick(item)}
                                                       className="btn-withdraw"
                                                       variant="contained"
                                                       sx={{ mr: 1 }}
                                                        >
                                                        Add
                                                        </Button>
                                                        </span>
                                                        <span>
                                                        <Button
                                                          onClick={() => handleRemoveButtonClick(item)}
                                                          className="btn-withdraw"
                                                          variant="contained"
                                                          color="error"
                                                          disabled={!item.allotedApps || item.allotedApps.length === 0}
                                                          >
                                                          Remove
                                                         </Button>
                                                         </span>
                                                 </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: 20 }}>
                                    <Stack spacing={2}>
                                        <Pagination
                                            count={totalPages}
                                            color="secondary"
                                            page={currentPage}
                                            onChange={(Event, New_Page) =>
                                                setCurrentPage(New_Page)
                                            }
                                        />
                                    </Stack>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    </>
}

export default Add_Roles_And_Responsibilities