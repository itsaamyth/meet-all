import * as store from "./store.js";
import * as ui from "./ui.js";
import * as webRTCHandler from "./webRTCHandler.js";
import * as constants from "./constants.js";
import * as strangerUtils from "./strangerUtils.js";
let socketIO = null;
export const registerSocketEvents = (socket) => {
  socket.on("connect", () => {
    socketIO = socket;
    console.log("successfuly connected to wss server");
    store.setSocketId(socket.id);
    console.log(socket.id);
    ui.updatePersonalCode(socket.id);
  });

  socket.on("pre-offer", (data) => {
    console.log(data);
    webRTCHandler.handlePreOffer(data);
  });

  socket.on("pre-offer-answer", (data) => {
    console.log(data);
    webRTCHandler.handlePreOfferAnswer(data);
  });

  socket.on("webRTC-signaling", (data) => {
    switch (data.type) {
      case constants.webRTCSignaling.OFFER:
        webRTCHandler.handleWebRTCOffer(data);
        break;
      case constants.webRTCSignaling.ANSWER:
        webRTCHandler.handleWebRTCAnswer(data);
      case constants.webRTCSignaling.ICE_CANDIDATE:
        webRTCHandler.handleWebRTCCandidate(data);
        break;
      default:
        return;
    }
  });
  socket.on("user-hanged-up", () => {
    webRTCHandler.handleConnectedUserHangedUp();
  });

  socket.on("stranger-socket-id", (data) => {
    strangerUtils.connectWithStranger(data);
  });
};

export const sendPreOffer = (data) => {
  socketIO.emit("pre-offer", data);
};

export const sendPreOfferAnswer = (data) => {
  socketIO.emit("pre-offer-answer", data);
};
export const sendDataUsingWebRTCSignaling = (data) => {
  socketIO.emit("webRTC-signaling", data);
};
export const sendUserHangedUp = (data) => {
  socketIO.emit("user-hanged-up", data);
};
export const changeStrangerConnectionStatus = (data) => {
  socketIO.emit("stranger-connection-status", data);
};
export const getStrangerSocketId = () => {
  socketIO.emit("get-stranger-socket-id");
};
