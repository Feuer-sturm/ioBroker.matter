import React from 'react';
import { withStyles } from '@mui/styles';
import { v4 as uuidv4 } from 'uuid';
import { ThemeProvider, StyledEngineProvider } from '@mui/material/styles';

import {
    AppBar,
    Tabs,
    Tab,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    Switch,
    Tooltip,
    TextField,
    Table,
    TableRow,
    TableCell,
    TableBody,
    Fab, MenuItem,
} from '@mui/material';

import {
    Add,
    Close,
    Delete,
    Edit,
    KeyboardArrowDown,
    KeyboardArrowUp,
    QuestionMark,
    Save,
    UnfoldLess,
    UnfoldMore,
} from '@mui/icons-material';

import GenericApp from '@iobroker/adapter-react-v5/GenericApp';
import { I18n, Loader, AdminConnection } from '@iobroker/adapter-react-v5';

import { getText } from './Utils';
import DeviceDialog, { DEVICE_ICONS } from './DeviceDialog';

const productIDs = [];
for (let i = 0x8000; i <= 0x801F; i++) {
    productIDs.push(`0x${i.toString(16)}`);
}

const styles = theme => ({
    root: {},
    tabContent: {
        padding: 10,
        height: 'calc(100% - 64px - 48px - 20px)',
        overflow: 'auto',
    },
    tabContentIFrame: {
        padding: 10,
        height: 'calc(100% - 64px - 48px - 20px - 38px)',
        overflow: 'auto',
    },
    selected: {
        color: theme.palette.mode === 'dark' ? undefined : '#FFF !important',
    },
    indicator: {
        backgroundColor: theme.palette.mode === 'dark' ? theme.palette.secondary.main : '#FFF',
    },
    bridgeName: {
        marginTop: 4,
        fontSize: 16,
        fontWeight: 'bold',
},
    bridgeTitle: {
        fontStyle: 'italic',
        fontSize: 12,
        // fontWeight: 'bold',
        marginRight: 4,
        opacity: 0.6,
    },
    bridgeValue: {
        fontStyle: 'italic',
        fontSize: 12,
        fontWeight: 'normal',
        marginRight: 8,
        opacity: 0.6,
    }
});

class App extends GenericApp {
    constructor(props) {
        const extendedProps = { ...props };
        extendedProps.encryptedFields = ['pass'];
        extendedProps.Connection = AdminConnection;
        extendedProps.translations = {
            en: require('./i18n/en'),
            de: require('./i18n/de'),
            ru: require('./i18n/ru'),
            pt: require('./i18n/pt'),
            nl: require('./i18n/nl'),
            fr: require('./i18n/fr'),
            it: require('./i18n/it'),
            es: require('./i18n/es'),
            pl: require('./i18n/pl'),
            uk: require('./i18n/uk'),
            'zh-cn': require('./i18n/zh-cn'),
        };

        extendedProps.sentryDSN = window.sentryDSN;
        // extendedProps.socket = {
        //     protocol: 'http:',
        //     host: '192.168.178.45',
        //     port: 8081,
        // };

        super(props, extendedProps);

        this.state.selectedTab = window.localStorage.getItem(`${this.adapterName}.${this.instance}.selectedTab`) || 'controller';

        this.state.bridgesOpened = {};
        try {
            this.state.bridgesOpened = JSON.parse(window.localStorage.getItem(`${this.adapterName}.${this.instance}.bridgesOpened`)) || {};
        } catch {
            //
        }

        this.state.detectedDevices = null;

        this.state.dialog = false;
    }

    async onConnectionReady() {
        this.socket.getState(`${this.adapterName}.${this.instance}.info.ackTempPassword`)
            .then(state => {
                if (!state || !state.val) {
                    this.setState({ showAckTempPasswordDialog: true });
                }
            });
        const matter = JSON.parse(JSON.stringify(this.state.native));
        matter.controller = matter.controller || { enabled: true };
        matter.devices = matter.devices || [];
        if (matter.devices.list) {
            matter.devices = matter.devices.list;
        }
        matter.bridges = matter.bridges || [];
        if (matter.bridges.list) {
            matter.bridges = matter.bridges.list;
        }
        const changed = this.getIsChanged(matter);
        this.setState({ native: matter, changed, ready: true });
    }

    renderController() {
        return <div>
            {I18n.t('Off')}
            <Switch
                checked={this.state.native.controller.enabled}
                onChange={e => {
                    const matter = JSON.parse(JSON.stringify(this.state.native));
                    matter.controller.enabled = e.target.checked;
                    this.updateNativeValue('controller', matter.controller);
                }}
            />
            {I18n.t('On')}
        </div>;
    }

    addDevices = devices => {
        const matter = JSON.parse(JSON.stringify(this.state.native));
        devices.forEach(device => {
            if (!matter.devices.find(d => d.oid === device)) {
                matter.devices.push({
                    oid: device._id,
                    type: device.deviceType,
                    name: getText(device.common.name),
                    uuid: uuidv4(),
                    productID: device.productID,
                    vendorID: device.vendorID,
                    enabled: true,
                });
            }
        });
        this.updateNativeValue('devices', matter.devices);
    };

    addDevicesToBridge = devices => {
        const matter = JSON.parse(JSON.stringify(this.state.native));
        if (this.state.dialog.bridge !== undefined) {
            const bridge = matter.bridges[this.state.dialog.bridge];
            devices.forEach(device => {
                if (!bridge.find(d => d.oid === device._id)) {
                    bridge.push({
                        oid: device._id,
                        type: device.deviceType,
                        name: getText(device.common.name),
                        uuid: uuidv4(),
                        enabled: true,
                    });
                }
            });
        } else {
            const bridge = {
                name: 'New bridge',
                enabled: true,
                list: devices.map(device => ({
                    oid: device._id,
                    type: device.deviceType,
                    name: getText(device.common.name),
                    enabled: true,
                })),
                uuid: uuidv4(),
            };
            matter.bridges.push(bridge);
        }
        this.updateNativeValue('bridges', matter.bridges);
    };

    renderBridges() {
        return <div>
            <div>
                <Tooltip title={I18n.t('Add bridge')}>
                    <Fab
                        onClick={() => this.setState(
                            {
                                editDialog: {
                                    type: 'bridge',
                                    name: '',
                                    originalName: '',
                                    add: true,
                                    vendorID: '0xFFF1',
                                    originalVendorID: '0xFFF1',
                                    productID: '0x8000',
                                    originalProductID: '0x8000',
                                },
                            },
                        )}
                        style={{
                            position: 'absolute',
                            right: 20,
                            bottom: 84,
                        }}
                    >
                        <Add />
                    </Fab>
                </Tooltip>
            </div>
            {this.state.native.bridges.length ? <div>
                <Tooltip title={I18n.t('Expand all')}>
                    <IconButton
                        onClick={() => {
                            const bridgesOpened = JSON.parse(JSON.stringify(this.state.bridgesOpened));
                            Object.keys(bridgesOpened).forEach(key => bridgesOpened[key] = true);
                            window.localStorage.setItem(`${this.adapterName}.${this.instance}.bridgesOpened`, JSON.stringify(bridgesOpened));
                            this.setState({ bridgesOpened });
                        }}
                        disabled={Object.values(this.state.bridgesOpened).every(v => v === true)}
                    >
                        <UnfoldMore />
                    </IconButton>
                </Tooltip>
                <Tooltip title={I18n.t('Collapse all')}>
                    <IconButton
                        onClick={() => {
                            const bridgesOpened = JSON.parse(JSON.stringify(this.state.bridgesOpened));
                            Object.keys(bridgesOpened).forEach(key => bridgesOpened[key] = false);
                            window.localStorage.setItem(`${this.adapterName}.${this.instance}.bridgesOpened`, JSON.stringify(bridgesOpened));
                            this.setState({ bridgesOpened });
                        }}
                        disabled={Object.values(this.state.bridgesOpened).every(v => v === false)}
                    >
                        <UnfoldLess />
                    </IconButton>
                </Tooltip>
            </div> : I18n.t('No bridges created. Create one, by clicking on the "+" button in the bottom right corner.')}
            <Table size="small" style={{ width: '100%', maxWidth: 600 }} padding="none">
                <TableBody>
                {
                    this.state.native.bridges.map((bridge, index) => <React.Fragment key={index}>
                        <TableRow sx={theme => (
                            {
                                backgroundColor: theme.palette.secondary.main,
                                '&>td:first-child': {
                                    borderTopLeftRadius: 4,
                                    borderBottomLeftRadius: 4,
                                },
                                '&>td:last-child': {
                                    borderTopRightRadius: 4,
                                    borderBottomRightRadius: 4,
                                },
                                opacity: bridge.enabled ? 1 : 0.4,
                            }
                        )}
                        >
                            <TableCell style={{ width: 0 }}>
                                <IconButton
                                    size="small"
                                    onClick={() => {
                                        const bridgesOpened = JSON.parse(JSON.stringify(this.state.bridgesOpened));
                                        bridgesOpened[index] = !bridgesOpened[index];
                                        window.localStorage.setItem(`${this.adapterName}.${this.instance}.bridgesOpened`, JSON.stringify(bridgesOpened));
                                        this.setState({ bridgesOpened });
                                    }}
                                >
                                    {this.state.bridgesOpened[index] ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
                                </IconButton>
                            </TableCell>
                            <TableCell
                                style={{ cursor: 'pointer' }}
                                onClick={() => {
                                    const bridgesOpened = JSON.parse(JSON.stringify(this.state.bridgesOpened));
                                    bridgesOpened[index] = !bridgesOpened[index];
                                    window.localStorage.setItem(`${this.adapterName}.${this.instance}.bridgesOpened`, JSON.stringify(bridgesOpened));
                                    this.setState({ bridgesOpened });
                                }}
                            >
                                <div className={this.props.classes.bridgeDiv}>
                                    <div className={this.props.classes.bridgeName}>{bridge.name}</div>
                                    <div>
                                        <span className={this.props.classes.bridgeTitle}>{I18n.t('Vendor ID')}:</span>
                                        <span className={this.props.classes.bridgeValue}>{bridge.vendorID || ''}</span>
                                        <span className={this.props.classes.bridgeTitle}>, {I18n.t('Product ID')}:</span>
                                        <span className={this.props.classes.bridgeValue}>{bridge.productID || ''}</span>
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell style={{ width: 0 }}>
                                <Switch
                                    checked={bridge.enabled}
                                    onClick={e => e.stopPropagation()}
                                    onChange={e => {
                                        const matter = JSON.parse(JSON.stringify(this.state.native));
                                        matter.bridges[index].enabled = e.target.checked;
                                        this.updateNativeValue('bridges', matter.bridges);
                                    }}
                                />
                            </TableCell>
                            <TableCell style={{ width: 0 }}>
                                <Tooltip title={I18n.t('Edit bridge')}>
                                    <IconButton onClick={e => {
                                        e.stopPropagation();
                                        this.setState(
                                            {
                                                editDialog: {
                                                    type: 'bridge',
                                                    name: bridge.name,
                                                    originalName: bridge.name,
                                                    bridge: index,
                                                    vendorID: bridge.vendorID,
                                                    originalVendorID: bridge.vendorID,
                                                    productID: bridge.productID,
                                                    originalProductID: bridge.productID,
                                                },
                                            },
                                        );
                                    }}
                                    >
                                        <Edit />
                                    </IconButton>
                                </Tooltip>
                            </TableCell>
                            <TableCell style={{ width: 0 }}>
                                <Tooltip title={I18n.t('Delete bridge')}>
                                    <IconButton onClick={e => {
                                        e.stopPropagation();
                                        this.setState(
                                            {
                                                deleteDialog: {
                                                    type: 'bridge',
                                                    name: bridge.name,
                                                    bridge: index,
                                                },
                                            },
                                        );
                                    }}
                                    >
                                        <Delete />
                                    </IconButton>
                                </Tooltip>
                            </TableCell>
                        </TableRow>
                        {(this.state.bridgesOpened[index] || false) && <>
                            <TableRow>
                                <TableCell style={{ border: 0 }} />
                                <TableCell style={{ border: 0 }}>
                                    <b>{I18n.t('Devices')}</b>
                                    <Tooltip title={I18n.t('Add device')}>
                                        <IconButton onClick={() => this.setState(
                                            {
                                                dialog: {
                                                    type: 'bridge',
                                                    name: bridge.name,
                                                    bridge: index,
                                                    devices: bridge.list,
                                                    addDevices: this.addDevicesToBridge,
                                                },
                                            },
                                        )}
                                        >
                                            <Add />
                                        </IconButton>
                                    </Tooltip>
                                </TableCell>
                            </TableRow>
                            {bridge.list.map((device, index2) => <TableRow
                                key={index2}
                                style={{ opacity: device.enabled && bridge.enabled ? 1 : 0.4 }}
                            >
                                <TableCell style={{ border: 0 }} />
                                <TableCell>
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                        <span style={{ marginRight: 8 }} title={device.type}>
                                            {DEVICE_ICONS[device.type] || <QuestionMark />}
                                        </span>
                                        {device.name}
                                    </div>
                                </TableCell>
                                <TableCell style={{ width: 0 }}>
                                    <Switch
                                        checked={device.enabled}
                                        onChange={e => {
                                            const matter = JSON.parse(JSON.stringify(this.state.native));
                                            matter.bridges[index].list[index2].enabled = e.target.checked;
                                            this.updateNativeValue('bridges', matter.bridges);
                                        }}
                                    />
                                </TableCell>
                                <TableCell style={{ width: 0 }}>
                                    <Tooltip title={I18n.t('Edit device')}>
                                        <IconButton onClick={() => {
                                            this.setState(
                                                {
                                                    editDialog: {
                                                        type: 'device',
                                                        name: device.name,
                                                        originalName: device.name,
                                                        bridge: index,
                                                        device: index2,
                                                        vendorID: false,
                                                        productID: false,
                                                        originalVendorID: false,
                                                        originalProductID: false,
                                                    },
                                                },
                                            );
                                        }}
                                        >
                                            <Edit />
                                        </IconButton>
                                    </Tooltip>
                                </TableCell>
                                <TableCell style={{ width: 0 }}>
                                    <Tooltip title={I18n.t('Delete device')}>
                                        <IconButton onClick={() => {
                                            this.setState(
                                                {
                                                    deleteDialog: {
                                                        type: 'device',
                                                        name: device.name,
                                                        bridge: index,
                                                        device: index2,
                                                    },
                                                },
                                            );
                                        }}
                                        >
                                            <Delete />
                                        </IconButton>
                                    </Tooltip>
                                </TableCell>
                            </TableRow>)}
                        </>}
                    </React.Fragment>)
                }
                </TableBody>
            </Table>
        </div>;
    }

    renderDevices() {
        return <div>
            <div>
                <Tooltip title={I18n.t('Add device')}>
                    <Fab
                        onClick={() => this.setState(
                            {
                                dialog: {
                                    type: 'device',
                                    devices: this.state.native.devices,
                                    addDevices: this.addDevices,
                                },
                            },
                        )}
                        style={{
                            position: 'absolute',
                            right: 20,
                            bottom: 84,
                        }}
                    >
                        <Add />
                    </Fab>
                </Tooltip>
            </div>
            {!this.state.native.devices.length ?
                I18n.t('No one device created. Create one, by clicking on the "+" button in the bottom right corner.') :
                <Table size="small" style={{ width: '100%', maxWidth: 600 }} padding="none">
                    <TableBody>
                        {
                            this.state.native.devices.map((device, index) => <TableRow
                                key={index}
                                style={{ opacity: device.enabled ? 1 : 0.4 }}
                            >
                                <TableCell>
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                        <span style={{ marginRight: 8 }} title={device.type}>
                                            {DEVICE_ICONS[device.type] || <QuestionMark />}
                                        </span>
                                        <div className={this.props.classes.bridgeDiv}>
                                            <div className={this.props.classes.bridgeName}>{device.name}</div>
                                            <div>
                                                <span className={this.props.classes.bridgeTitle}>{I18n.t('Vendor ID')}:</span>
                                                <span className={this.props.classes.bridgeValue}>{device.vendorID || ''}</span>
                                                <span className={this.props.classes.bridgeTitle}>, {I18n.t('Product ID')}:</span>
                                                <span className={this.props.classes.bridgeValue}>{device.productID || ''}</span>
                                            </div>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell style={{ width: 0 }}>
                                    <Switch
                                        checked={device.enabled}
                                        onChange={e => {
                                            const matter = JSON.parse(JSON.stringify(this.state.native));
                                            matter.devices[index].enabled = e.target.checked;
                                            this.updateNativeValue('devices', matter.devices);
                                        }}
                                    />
                                </TableCell>
                                <TableCell style={{ width: 0 }}>
                                    <Tooltip title={I18n.t('Edit device')}>
                                        <IconButton onClick={() => {
                                            this.setState(
                                                {
                                                    editDialog: {
                                                        type: 'device',
                                                        name: device.name,
                                                        originalName: device.name,
                                                        device: index,
                                                        vendorID: device.vendorID,
                                                        productID: device.productID,
                                                        originalVendorID: device.vendorID,
                                                        originalProductID: device.productID,
                                                    },
                                                },
                                            );
                                        }}
                                        >
                                            <Edit />
                                        </IconButton>
                                    </Tooltip>
                                </TableCell>
                                <TableCell style={{ width: 0 }}>
                                    <Tooltip title={I18n.t('Delete device')}>
                                        <IconButton onClick={() => {
                                            this.setState(
                                                {
                                                    deleteDialog: {
                                                        type: 'device',
                                                        name: device.name,
                                                        device: index,
                                                    },
                                                },
                                            );
                                        }}
                                        >
                                            <Delete />
                                        </IconButton>
                                    </Tooltip>
                                </TableCell>
                            </TableRow>)
                        }
                    </TableBody>
                </Table>}
        </div>;
    }

    renderEditDialog() {
        const save = () => {
            const matter = JSON.parse(JSON.stringify(this.state.native));
            if (this.state.editDialog.add) {
                matter.bridges.push({
                    name: this.state.editDialog.name,
                    enabled: true,
                    productID: this.state.editDialog.productID,
                    vendorID: this.state.editDialog.vendorID,
                    list: [],
                    uuid: uuidv4(),
                });
                this.updateNativeValue('bridges', matter.bridges);
            } else if (this.state.editDialog.type === 'bridge') {
                matter.bridges[this.state.editDialog.bridge].name = this.state.editDialog.name;
                matter.bridges[this.state.editDialog.bridge].productID = this.state.editDialog.productID;
                matter.bridges[this.state.editDialog.bridge].vendorID = this.state.editDialog.vendorID;
                this.updateNativeValue('bridges', matter.bridges);
            } else if (this.state.editDialog.bridge !== undefined) {
                matter.bridges[this.state.editDialog.bridge].list[this.state.editDialog.device].name = this.state.editDialog.name;
                this.updateNativeValue('bridges', matter.bridges);
            } else {
                matter.devices[this.state.editDialog.device].name = this.state.editDialog.name;
                matter.devices[this.state.editDialog.device].productID = this.state.editDialog.productID;
                matter.devices[this.state.editDialog.device].vendorID = this.state.editDialog.vendorID;
                this.updateNativeValue('devices', matter.devices);
            }
            this.setState({ editDialog: false });
        };

        const isDisabled =
            this.state.editDialog?.name === this.state.editDialog?.originalName &&
            this.state.editDialog?.vendorID === this.state.editDialog?.originalVendorID &&
            this.state.editDialog?.productID === this.state.editDialog?.originalProductID;

        return <Dialog onClose={() => this.setState({ editDialog: false })} open={!!this.state.editDialog}>
            <DialogTitle>
                {this.state.editDialog?.add ?
                    I18n.t('Add bridge') :
                    `${
                        this.state.editDialog?.type === 'bridge' ? I18n.t('Edit bridge') : I18n.t('Edit device')
                    } ${
                        this.state.editDialog?.originalName
                    }`}
            </DialogTitle>
            {this.state.editDialog && <DialogContent>
                <TextField
                    label={I18n.t('Name')}
                    value={this.state.editDialog.name}
                    onChange={e => {
                        const editDialog = JSON.parse(JSON.stringify(this.state.editDialog));
                        editDialog.name = e.target.value;
                        this.setState({ editDialog });
                    }}
                    onKeyUp={e => e.key === 'Enter' && !isDisabled && save()}
                    variant="standard"
                    fullWidth
                />
                {this.state.editDialog.vendorID !== false ? <TextField
                    select
                    style={{ width: 'calc(50% - 8px)', marginRight: 16, marginTop: 16, }}
                    value={this.state.editDialog.vendorID}
                    onChange={e => {
                        const editDialog = JSON.parse(JSON.stringify(this.state.editDialog));
                        editDialog.vendorID = e.target.value;
                        this.setState({ editDialog });
                    }}
                    label={I18n.t('Vendor ID')}
                    helperText={<span style={{ display: 'block', height: 20 }} />}
                    variant="standard"
                >
                    {['0xFFF1', '0xFFF2', '0xFFF3', '0xFFF4'].map(vendorID =>
                        <MenuItem
                            key={vendorID}
                            value={vendorID}
                        >
                            {vendorID}
                        </MenuItem>)}
                </TextField> : null}
                {this.state.editDialog.productID !== false ? <TextField
                    select
                    style={{ width: 'calc(50% - 8px)', marginTop: 16, }}
                    value={this.state.editDialog.productID}
                    onChange={e => {
                        const editDialog = JSON.parse(JSON.stringify(this.state.editDialog));
                        editDialog.productID = e.target.value;
                        this.setState({ editDialog });
                    }}
                    label={I18n.t('Product ID')}
                    helperText={<span style={{ display: 'block', height: 20 }} />}
                    variant="standard"
                >
                    {productIDs.map(productID =>
                        <MenuItem
                            key={productID}
                            value={productID}
                        >
                            {productID}
                        </MenuItem>)}
                </TextField> : null}
            </DialogContent>}
            <DialogActions>
                <Button
                    onClick={save}
                    startIcon={this.state.editDialog?.add ? <Add /> : <Save />}
                    disabled={isDisabled}
                    color="primary"
                    variant="contained"
                >
                    {this.state.editDialog?.add ? I18n.t('Add') : I18n.t('Save')}
                </Button>
                <Button
                    onClick={() => this.setState({ editDialog: false })}
                    startIcon={<Close />}
                    color="grey"
                    variant="contained"
                >
                    {I18n.t('Cancel')}
                </Button>
            </DialogActions>
        </Dialog>;
    }

    renderDeleteDialog() {
        return <Dialog onClose={() => this.setState({ deleteDialog: false })} open={!!this.state.deleteDialog}>
            <DialogTitle>{I18n.t('Delete')}</DialogTitle>
            {this.state.deleteDialog && <DialogContent>
                {`${
                    this.state.deleteDialog.type === 'bridge' ?
                        I18n.t('Do you want to delete bridge') :
                        I18n.t('Do you want to delete device')} ${
                    this.state.deleteDialog.name
                }?`}
            </DialogContent>}
            <DialogActions>
                <Button
                    onClick={() => {
                        const matter = JSON.parse(JSON.stringify(this.state.native));
                        if (this.state.deleteDialog.type === 'bridge') {
                            matter.bridges.splice(this.state.deleteDialog.bridge, 1);
                            this.updateNativeValue('bridges', matter.bridges);
                        } else if (this.state.deleteDialog.bridge !== undefined) {
                            matter.bridges[this.state.deleteDialog.bridge].list.splice(this.state.deleteDialog.device, 1);
                            this.updateNativeValue('bridges', matter.bridges);
                        } else {
                            matter.devices.splice(this.state.deleteDialog.device, 1);
                            this.updateNativeValue('devices', matter.devices);
                        }
                        this.setState({ deleteDialog: false });
                    }}
                    startIcon={<Delete />}
                    color="primary"
                    variant="contained"
                >
                    {I18n.t('Delete')}
                </Button>
                <Button
                    onClick={() => this.setState({ deleteDialog: false })}
                    startIcon={<Close />}
                    color="grey"
                    variant="contained"
                >
                    {I18n.t('Cancel')}
                </Button>
            </DialogActions>
        </Dialog>;
    }

    render() {
        if (!this.state.ready) {
            return <StyledEngineProvider injectFirst>
                <ThemeProvider theme={this.state.theme}>
                    <Loader theme={this.state.themeType} />
                </ThemeProvider>
            </StyledEngineProvider>;
        }

        return <StyledEngineProvider injectFirst>
            <ThemeProvider theme={this.state.theme}>
                <DeviceDialog
                    open={!!this.state.dialog}
                    onClose={() => this.setState({ dialog: false })}
                    {...(this.state.dialog || {})}
                    matter={this.state.native}
                    socket={this.socket}
                    themeType={this.state.themeType}
                    detectedDevices={this.state.detectedDevices}
                    setDetectedDevices={detectedDevices => this.setState({ detectedDevices })}
                />
                {this.renderEditDialog()}
                {this.renderDeleteDialog()}
                <div className="App" style={{ background: this.state.theme.palette.background.default, color: this.state.theme.palette.text.primary }}>
                    <AppBar position="static">
                        <Tabs
                            value={this.state.selectedTab || 'controller'}
                            onChange={(e, value) => {
                                this.setState({ selectedTab: value });
                                window.localStorage.setItem(`${this.adapterName}.${this.instance}.selectedTab`, value);
                            }}
                            scrollButtons="auto"
                            classes={{ indicator: this.props.classes.indicator }}
                        >
                            <Tab classes={{ selected: this.props.classes.selected }} label={I18n.t('Controller')} value="controller" />
                            <Tab classes={{ selected: this.props.classes.selected }} label={I18n.t('Bridges')} value="bridges" />
                            <Tab classes={{ selected: this.props.classes.selected }} label={I18n.t('Devices')} value="devices" />
                        </Tabs>
                    </AppBar>

                    <div className={this.isIFrame ? this.props.classes.tabContentIFrame : this.props.classes.tabContent}>
                        {this.state.selectedTab === 'controller' && this.renderController()}
                        {this.state.selectedTab === 'bridges' && this.renderBridges()}
                        {this.state.selectedTab === 'devices' && this.renderDevices()}
                    </div>
                    {this.renderError()}
                    {this.renderSaveCloseButtons()}
                </div>
            </ThemeProvider>
        </StyledEngineProvider>;
    }
}

export default withStyles(styles)(App);
