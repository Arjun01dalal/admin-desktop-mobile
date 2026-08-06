import React, {
  ChangeEvent,
  FormEvent,
  useContext,
  useEffect,
  useState,
} from "react";
import "../../../../Css/style.css";
import "../../../../Css/table.css";
import Sidenav from "../../../../Components/SideNavigation/SideNavigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPencilSquare, faTrashCan } from "@fortawesome/free-solid-svg-icons";
import Button from "@mui/material/Button";
import {
  Dialog,
  DialogActions,
  DialogContent,
  FormGroup,
  TextField,
  DialogTitle,
} from "@material-ui/core";
import axios from "axios";
import { API_Endpoint } from "../../../../Configuration/Settings";
import Stateful_Checkbox from "../../../../Components/Checkbox/Checkbox";
import { Responsibilities } from "../../../../Configuration/Enums";
import { User_Context } from "../../../../Contexts/User";
import { decryptData } from "../../../../utils/decryptData";
import { encryptData } from "../../../../utils/encryptData";
import Breadcrumbs from "../../../../Components/Breadcrumbs/Breadcrumbs";
import Reusable_Input from "../../../../Components/InputField/InputField";
import { useNavigate } from "react-router-dom";
import CreateResponsibilityModal from "./CreateResponsibilityModal";
import CloneRoleModal from "./CloneRoleModal";
interface Responsibility {
  _id: string;
  Enum: string;
  Name: string;
  Group: string;
}
interface Role {
  _id: string;
  Name: string;
  Responsibilities: string[];
}
function RolesResponsibilities() {
  const [updatePopup, setUpdatePopup] = useState<boolean>(false);
  const [roleId, setRoleId] = useState<string>("");
  const [updateName, setUpdateName] = useState("");
  const [updateNameError, setUpdateNameError] = useState<boolean>(false);
  const [updateNameHelperText, setUpdateNameHelperText] = useState<string>("");
  const [responsibilities, setResponsibilities] = useState<Responsibility[]>(
    [],
  );
  const [Responsibility_Array, Set_Responsibility_Array] = useState<string[]>(
    [],
  );
  const [roles, setRoles] = useState<Role[]>([]);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [deletePopup, setDeletePopup] = useState<boolean>(false);
  const [openModal, setOpenModal] = useState(false);
  const [openCloneRole, setOpenCloneRole] = useState(false);

  const [formMode, setFormMode] = useState<"Add" | "Edit">("Add");
  const { User } = useContext(User_Context);
  const navigate = useNavigate();

  const addRoles = () => {
    let data = {
      Name: updateName,
      Responsibilities: Responsibility_Array,
    };

    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: `${API_Endpoint}/roles/add`,
      headers: {
        Authorization: `Bearer ${User.token}`,
        "Content-Type": "application/json",
      },
      data: { token: encryptData(data) },
    };

    axios
      .request(config)
      .then(async (response) => {
        const Roles_Copy = [...roles];
        response.data.data = await decryptData(response.data.data);
        response.data.data = response.data.data.payload;
        Roles_Copy.push({
          _id: response.data.data._id,
          Name: response.data.data.Name,
          Responsibilities: response.data.data.Responsibilities,
        });
        setRoles(Roles_Copy);
      })
      .catch((error) => {
        console.error(error);
      });
  };
  const updateRoles = () => {
    let data = {
      _id: roleId,
      Name: updateName,
      Responsibilities: Responsibility_Array,
    };

    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: `${API_Endpoint}/roles/update`,
      headers: {
        Authorization: `Bearer ${User.token}`,
        "Content-Type": "application/json",
      },
      data: { token: encryptData(data) },
    };

    axios
      .request(config)
      .then(() => {
        const Roles_Copy = [...roles];
        const Current_Role = Roles_Copy.find((Role) => Role._id === roleId);
        if (Current_Role !== undefined) {
          Current_Role.Responsibilities = Responsibility_Array;
          setRoles(Roles_Copy);
        }
      })
      .catch((error) => {
        console.error(error);
      });
  };
  const handleUpdateSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (formMode === "Add") {
      addRoles();
    } else if (formMode === "Edit") {
      updateRoles();
    }
    Close_Pop_Up();
    setUpdateName("");
    Set_Responsibility_Array([]);
    setFormMode("Add");

    if (!updateName) {
      setUpdateNameError(true);
      setUpdateNameHelperText("Please enter name you want to update");
    }
  };
  const openEditDialog = (Name: string, Role: string) => {
    setUpdateName(Name);
    setRoleId(Role);
    Set_Responsibility_Array(
      roles.find((Item) => Item._id === Role)?.Responsibilities || [],
    );
    setFormMode("Edit");
    setUpdatePopup(true);
  };

  const Close_Pop_Up = () => {
    Set_Responsibility_Array([]);
    setRoleId("");
    setUpdatePopup(false);
  };

  const openAddDialog = () => {
    setUpdateName("");
    setFormMode("Add");
    setUpdatePopup(true);
  };

  const handleUpdateNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    setUpdateName(event.target.value);
    setUpdateNameError(false);
  };

  const Change_Responsibilities = (Responsibility_ID: string) => {
    return (Checked: boolean): void => {
      const Responsibility_Array_Copy = [...Responsibility_Array];
      if (Checked) {
        Responsibility_Array_Copy.push(Responsibility_ID);
        Set_Responsibility_Array([...new Set(Responsibility_Array_Copy)]);
      } else {
        Set_Responsibility_Array(
          [...new Set(Responsibility_Array_Copy)].filter(
            (Item) => Item !== Responsibility_ID,
          ),
        );
      }
    };
  };

  useEffect(() => {
    let responsibilitiesConfig = {
      method: "post",
      maxBodyLength: Infinity,
      url: `${API_Endpoint}/responsibilities`,
      headers: {
        Authorization: `Bearer ${User.token}`,
      },
      data: { token: encryptData({}) },
    };

    axios
      .request(responsibilitiesConfig)
      .then(async (response) => {
        response.data.data = await decryptData(response.data.data);
        setResponsibilities(response.data.data.payload);
      })
      .catch((error) => {
        console.error(error);
      });
    let rolesConfig = {
      method: "post",
      maxBodyLength: Infinity,
      url: `${API_Endpoint}/roles`,
      headers: {
        Authorization: `Bearer ${User.token}`,
      },
      data: { token: encryptData({}) },
    };

    axios
      .request(rolesConfig)
      .then(async (response) => {
        response.data.data = await decryptData(response.data.data);
        console.log("roles", response.data.data);
        setRoles(response.data.data.payload);
      })
      .catch((error) => {
        console.error(error);
      });
  }, []);

  const handleViewAllClick = (itemId: string) => {
    setExpandedItemId(itemId);
  };

  const openPopup = (id: string) => {
    setDeletePopup(true);
    setRoleId(id);
  };

  const deleteUser = () => {
    setDeletePopup(false);
    axios
      .post(
        `${API_Endpoint}/roles/delete`,
        { token: encryptData({ Role_ID: roleId }) },
        { headers: { Authorization: `Bearer ${User.token}` } },
      )
      .then((response) => {
        const updatedRoles = roles.filter((item) => item._id !== roleId);
        setRoles(updatedRoles);
      })
      .catch((error) => {
        console.error("error ", error);
      });
  };

  return (
    <>
      <Sidenav />
      <div className="g-sidenav-show  bg-gray-100">
        <main className="main-content position-relative">
          <div
            className="row tp-form mb-1"
            style={{ display: "flex", background: "#f8f9fa" }}
          >
            <Breadcrumbs
              tab={"Roles & Responsibilities"}
              button={
                <>
                  {/* <Button
                onClick={openAddDialog}
                className="btn-payment"
                variant="contained"
              >
                Add
              </Button> */}
                  {User.data.Responsibilities?.includes(
                    Responsibilities.Add_Coin_Permission,
                  ) && (
                    <>
                      <Button
                        onClick={() => navigate("/add-roles-responsibilities")}
                        className="btn-payment"
                        style={{ marginBottom: 10 }}
                        variant="contained"
                      >
                        Coin Permission
                      </Button>
                    </>
                  )}
                   {User.data.Responsibilities?.includes(
                    Responsibilities.add_new_role_responsibility,
                  ) && (
                    <>
                      <Button
                        onClick={() => setOpenCloneRole(true)}
                        className="btn-payment"
                        style={{ marginBottom: 10 }}
                        variant="contained"
                      >
                        Add Role
                      </Button>
                      <Button
                        onClick={() => setOpenModal(true)}
                        className="btn-payment"
                        style={{ marginBottom: 10 }}
                        variant="contained"
                      >
                        Add Responsibility
                      </Button>
                    </>
                  )}
                </>
              }
            />

            <div className="col-6 col-xl-2 col-sm-4 pdrt"></div>
            <div>
              <Dialog open={updatePopup} onClose={Close_Pop_Up}>
                <DialogContent>
                  <form>
                    <div>
                      <Reusable_Input
                        type={"text"}
                        label={"Name"}
                        fullWidth={true}
                        value={updateName}
                        error={updateNameError}
                        helperText={updateNameHelperText}
                        onChange={handleUpdateNameChange}
                      />
                    </div>
                    <div className="mt-2">
                      <h6>Responsibilities:</h6>
                    </div>
                    {[
                      ...new Set(
                        responsibilities.map(
                          (responsibility) => responsibility.Group,
                        ),
                      ),
                    ].map((Group_Name) => (
                      <div className="mt-1">
                        <label className="label-user m-0">{Group_Name}</label>
                        <FormGroup row>
                          {responsibilities
                            .filter(
                              (responsibility: Responsibility) =>
                                responsibility.Group === Group_Name,
                            )

                            .map((responsibility: Responsibility) => (
                              <Stateful_Checkbox
                                Callback={Change_Responsibilities(
                                  responsibility._id,
                                )}
                                Label={responsibility.Name}
                                key={responsibility._id}
                                Value={roles
                                  .find((Item) => Item._id === roleId)
                                  ?.Responsibilities.includes(
                                    responsibility._id,
                                  )}
                              />
                            ))}
                        </FormGroup>
                      </div>
                    ))}

                    <DialogActions>
                      <Button
                        className="btn-popup"
                        variant="outlined"
                        onClick={Close_Pop_Up}
                        color="primary"
                      >
                        Cancel
                      </Button>
                      <Button
                        className="btn-popup"
                        variant="outlined"
                        type="submit"
                        color="primary"
                        onClick={handleUpdateSubmit}
                      >
                        Submit
                      </Button>
                    </DialogActions>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            <div>
              <Dialog open={deletePopup} onClose={() => setDeletePopup(false)}>
                <DialogTitle>Are You Sure ?</DialogTitle>
                <DialogContent>
                  <DialogActions className="mt-n3">
                    <Button
                      className="btn-popup"
                      variant="outlined"
                      onClick={() => setDeletePopup(false)}
                      color="primary"
                    >
                      Cancel
                    </Button>
                    <Button
                      className="btn-popup"
                      variant="outlined"
                      type="submit"
                      color="primary"
                      onClick={() => deleteUser()}
                    >
                      Delete
                    </Button>
                  </DialogActions>
                </DialogContent>
              </Dialog>
            </div>
            <div className="container-fluid">
              <div className="row">
                <div className="col-12">
                  <div className="table-responsive">
                    <table className="table table-view">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Responsibilities</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expandedItemId ? (
                          <>
                            <tr>
                              <td></td>
                              <td rowSpan={1}>
                                {responsibilities
                                  .filter((responsibility) =>
                                    roles
                                      .find(
                                        (role) => role._id === expandedItemId,
                                      )
                                      ?.Responsibilities.includes(
                                        responsibility._id,
                                      ),
                                  )
                                  .map((responsibility) => (
                                    <div key={responsibility._id}>
                                      {responsibility.Name}
                                    </div>
                                  ))}
                                <Button onClick={() => setExpandedItemId(null)}>
                                  Close
                                </Button>
                              </td>
                              <td></td>
                            </tr>
                          </>
                        ) : (
                          <>
                            {roles.map((item: Role) => (
                              <tr key={item._id}>
                                <td>{item.Name}</td>
                                <td>
                                  {item.Responsibilities.map(
                                    (Responsibility_ID: string) =>
                                      responsibilities.find(
                                        (Value) =>
                                          Value._id === Responsibility_ID,
                                      )?.Name,
                                  )
                                    .join(", ")
                                    .slice(0, 100)}
                                  <Button
                                    onClick={() => handleViewAllClick(item._id)}
                                  >
                                    View All
                                  </Button>
                                </td>
                                <td>
                                  {User.data.Responsibilities.includes(
                                    Responsibilities.Edit_Role,
                                  ) && (
                                    <span>
                                      <FontAwesomeIcon
                                        className="fa fa-pencil-square icon-home icon-banner"
                                        icon={faPencilSquare}
                                        style={{ cursor: "pointer" }}
                                        onClick={() =>
                                          openEditDialog(item.Name, item._id)
                                        }
                                      />
                                    </span>
                                  )}
                                  {User.data.Responsibilities.includes(
                                    Responsibilities.Delete_Role,
                                  ) && (
                                    <span>
                                      <FontAwesomeIcon
                                        className="fa fa-pencil-square icon-home icon-trash "
                                        icon={faTrashCan}
                                        style={{ cursor: "pointer" }}
                                        onClick={() => openPopup(item._id)}
                                      />
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              <div>
                <footer className="footer">
                  <div className="container-fluid">
                    <div className="row align-items-center justify-content-lg-between">
                      <div className="col-lg-6 mb-lg-0  ">
                        <div className="copyright text-center text-sm text-muted text-lg-start">
                          © osgames.co
                        </div>
                      </div>
                    </div>
                  </div>
                </footer>
              </div>
            </div>
          </div>
        </main>
        <CreateResponsibilityModal
          open={openModal}
          onClose={() => setOpenModal(false)}
          userData={User}
        />
        <CloneRoleModal
          open={openCloneRole}
          onClose={() => setOpenCloneRole(false)}
          roles={roles}
          userData={User}
        />
        ; ;
      </div>
    </>
  );
}

export default RolesResponsibilities;
