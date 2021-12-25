import * as wss from "./wss.js";
import * as constants from "./constants.js";
import * as ui from "./ui.js";
import * as store from "./store.js";
let connectedUserDetails;
let peerConnection;
let dataChannel;
const defaultConstraints = {
  audio: true,
  video: true,
};
const configuration = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:13902",
    },
    {
      urls: "turn:13.250.13.83:3478?transport=udp",
      username: "YzYNCouZM1mhqhmseWk6",
      credential: "YzYNCouZM1mhqhmseWk6",
    },
    {
      urls: ["stun:hk-turn1.xirsys.com"],
    },
    {
      username:
        "tNhQ-8z6t0-HUO5yjcANN9yaQywJSI9pQQO1F77UH7mx64_dUNRVQw8CgQw5IHt6AAAAAGHG8vxkZWxtb3M=",
      credential: "cf084f7c-656d-11ec-a020-0242ac120004",
      urls: [
        "turn:hk-turn1.xirsys.com:80?transport=udp",
        "turn:hk-turn1.xirsys.com:3478?transport=udp",
        "turn:hk-turn1.xirsys.com:80?transport=tcp",
        "turn:hk-turn1.xirsys.com:3478?transport=tcp",
        "turns:hk-turn1.xirsys.com:443?transport=tcp",
        "turns:hk-turn1.xirsys.com:5349?transport=tcp",
      ],
    },
  ],
};
export const getLocalPreview = () => {
  navigator.mediaDevices
    .getUserMedia(defaultConstraints)
    .then((stream) => {
      ui.updateLocalVideo(stream);
      ui.showVideoCallButtons();
      store.setCallState(constants.callState.CALL_AVAILABLE);
      store.setLocalStream(stream);
    })
    .catch((err) => {
      console.log("error occured when trying to get access to camera");
      console.log(err);
    });
};
export const createPeerConnection = () => {
  peerConnection = new RTCPeerConnection(configuration);

  dataChannel = peerConnection.createDataChannel("chat");

  peerConnection.ondatachannel = (event) => {
    const dataChannel = event.channel;
    dataChannel.onopen = () => {
      console.log("peer connection is ready to receive data channel messages");
    };
    dataChannel.onmessage = (event) => {
      console.log("message came from data channel");
      const message = JSON.parse(event.data);
      ui.appendMessage(message, false);
      console.log(message);
    };
  };

  peerConnection.onicecandidate = (event) => {
    console.log("getting ice candidate from stun server");
    if (event.candidate) {
      //send out ice candidate to other peer
      wss.sendDataUsingWebRTCSignaling({
        connectedUserSocketId: connectedUserDetails.socketId,
        type: constants.webRTCSignaling.ICE_CANDIDATE,
        candidate: event.candidate,
      });
    }
  };
  peerConnection.onconnectionstatechange = (event) => {
    if (peerConnection.connectionState === "connected") {
      console.log("succesfully connected with other peer");
    }
  };
  //receiving tracks
  const remoteStream = new MediaStream();
  store.setRemoteStream(remoteStream);
  ui.updateRemoteVideo(remoteStream);

  peerConnection.ontrack = (event) => {
    remoteStream.addTrack(event.track);
  };

  //add our stream to peer connection
  if (
    connectedUserDetails.callType === constants.callType.VIDEO_PERSONAL_CODE ||
    connectedUserDetails.callType === constants.callType.VIDEO_STRANGER
  ) {
    const localStream = store.getState().localStream;
    for (const track of localStream.getTracks()) {
      peerConnection.addTrack(track, localStream);
    }
  }
};

export const sendMessageUsingDataChannel = (message) => {
  const stringifiedMessage = JSON.stringify(message);
  dataChannel.send(stringifiedMessage);
};
export const sendPreOffer = (callType, calleePersonalCode) => {
  connectedUserDetails = {
    callType,
    socketId: calleePersonalCode,
  };
  if (
    callType === constants.callType.CHAT_PERSONAL_CODE ||
    callType === constants.callType.VIDEO_PERSONAL_CODE
  ) {
    const data = {
      callType,
      calleePersonalCode,
    };

    ui.showCallingDialog(callingDialogRejectCallHandler);
    store.setCallState(constants.callState.CALL_UNAVAILABE);
    wss.sendPreOffer(data);
  }
  if (
    callType === constants.callType.CHAT_STRANGER ||
    callType === constants.callType.VIDEO_STRANGER
  ) {
    const data = {
      callType,
      calleePersonalCode,
    };

    store.setCallState(constants.callState.CALL_UNAVAILABE);
    wss.sendPreOffer(data);
  }
};
export const handlePreOffer = (data) => {
  const { callType, callerSocketId } = data;

  if (!checkCallPossibility()) {
    return sendPreOfferAnswer(
      constants.preOfferAnswer.CALL_UNAVAILABLE,
      callerSocketId
    );
  }
  connectedUserDetails = {
    socketId: callerSocketId,
    callType,
  };
  store.setCallState(constants.callState.CALL_UNAVAILABE);

  if (
    callType === constants.callType.CHAT_PERSONAL_CODE ||
    callType === constants.callType.VIDEO_PERSONAL_CODE
  ) {
    console.log(callType);
    ui.showIncomingCallDialog(callType, acceptCallHandler, rejectCallHandler);
  }

  if (
    callType === constants.callType.CHAT_STRANGER ||
    callType === constants.callType.VIDEO_STRANGER
  ) {
    createPeerConnection();
    sendPreOfferAnswer(constants.preOfferAnswer.CALL_ACCEPTED);
    ui.showCallElements(connectedUserDetails.callType);
  }
};
export const handlePreOfferAnswer = (data) => {
  console.log("pre offer answer came");
  console.log(data);
  ui.removeAllDialogs();
  const { preOfferAnswer } = data;
  console.log(preOfferAnswer);
  if (preOfferAnswer === constants.preOfferAnswer.CALLEE_NOT_FOUND) {
    ui.showInfoDialog(preOfferAnswer);
    setIncomingCallsAvailable();

    //show dialog that callee has not been found
  }
  if (preOfferAnswer === constants.preOfferAnswer.CALL_UNAVAILABLE) {
    ui.showInfoDialog(preOfferAnswer);
    setIncomingCallsAvailable();

    //show dialog that calllee is not able to connect
  }
  if (preOfferAnswer === constants.preOfferAnswer.CALL_REJECTED) {
    ui.showInfoDialog(preOfferAnswer);
    setIncomingCallsAvailable();
    //show dialog that call is rejected by the callee
  }
  if (preOfferAnswer === constants.preOfferAnswer.CALL_ACCEPTED) {
    //send webRTC offer
    ui.showCallElements(connectedUserDetails.callType);
    createPeerConnection();
    sendWebRTCOffer();
  }
};
const acceptCallHandler = () => {
  console.log("call accepted");
  createPeerConnection();
  sendPreOfferAnswer(constants.preOfferAnswer.CALL_ACCEPTED);
  ui.showCallElements(connectedUserDetails.callType);
};

const rejectCallHandler = () => {
  console.log("call rejected");
  setIncomingCallsAvailable();
  sendPreOfferAnswer(constants.preOfferAnswer.CALL_REJECTED);
};
const callingDialogRejectCallHandler = () => {
  const data = {
    connectedUserSocketId: connectedUserDetails.socketId,
  };
  closePeerConnectionAndResetState();
  wss.sendUserHangedUp(data);
  console.log("rejecting the call");
};
const sendPreOfferAnswer = (preOfferAnswer, callerSocketId = null) => {
  const socketId = callerSocketId
    ? callerSocketId
    : connectedUserDetails.socketId;
  const data = {
    callerSocketId: socketId,
    preOfferAnswer,
  };
  ui.removeAllDialogs();
  wss.sendPreOfferAnswer(data);
};
const sendWebRTCOffer = async () => {
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  wss.sendDataUsingWebRTCSignaling({
    connectedUserSocketId: connectedUserDetails.socketId,
    type: constants.webRTCSignaling.OFFER,
    offer: offer,
  });
};
export const handleWebRTCOffer = async (data) => {
  await peerConnection.setRemoteDescription(data.offer);
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  wss.sendDataUsingWebRTCSignaling({
    connectedUserSocketId: connectedUserDetails.socketId,
    type: constants.webRTCSignaling.ANSWER,
    answer: answer,
  });
};
export const handleWebRTCAnswer = async (data) => {
  console.log("handling webRTc answer");
  await peerConnection.setRemoteDescription(data.answer);
};
export const handleWebRTCCandidate = async (data) => {
  console.log(data);
  try {
    await peerConnection.addIceCandidate(data.candidate);
  } catch (err) {
    console.error(
      "error occure when trying to add received ice candidate",
      err
    );
  }
};

let screenSharingStream;
export const switchBetweenCameraAndScreenSharing = async (
  screenSharingActive
) => {
  if (screenSharingActive) {
    try {
      const localStream = store.getState().localStream;
      const senders = peerConnection.getSenders();
      const sender = senders.find((sender) => {
        return sender.track.kind === localStream.getVideoTracks()[0].kind;
      });
      if (sender) {
        sender.replaceTrack(localStream.getVideoTracks()[0]);
      }
      store
        .getState()
        .screenSharingStream.getTracks()
        .forEach((track) => {
          track.stop();
        });
      store.setScreenSharingActive(!screenSharingActive);
      ui.updateLocalVideo(localStream);
    } catch (err) {
      console.log("error while switching back to camera", err);
    }
  } else {
    console.log("switching for screen sharing");
    try {
      screenSharingStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      store.setScreenSharingStream(screenSharingStream);
      //replace track which sender is sending
      const senders = peerConnection.getSenders();
      const sender = senders.find((sender) => {
        return (
          sender.track.kind === screenSharingStream.getVideoTracks()[0].kind
        );
      });
      if (sender) {
        sender.replaceTrack(screenSharingStream.getVideoTracks()[0]);
      }
      store.setScreenSharingActive(!screenSharingActive);
      ui.updateLocalVideo(screenSharingStream);
      screenSharingStream.getVideoTracks()[0].onended = () => {
        const localStream = store.getState().localStream;
        const senders = peerConnection.getSenders();
        const sender = senders.find((sender) => {
          return sender.track.kind === localStream.getVideoTracks()[0].kind;
        });
        if (sender) {
          sender.replaceTrack(localStream.getVideoTracks()[0]);
        }
        store.setScreenSharingActive(screenSharingActive);
        ui.updateLocalVideo(localStream);
      };
    } catch (err) {
      console.log("Error occured while sharing screen", err);
    }
  }
};

//hangup
export const handleHangUp = () => {
  console.log("finishing the call");
  const data = {
    connectedUserSocketId: connectedUserDetails.socketId,
  };
  wss.sendUserHangedUp(data);
  closePeerConnectionAndResetState();
};
export const handleConnectedUserHangedUp = () => {
  console.log("connected peer hanged up ");
  closePeerConnectionAndResetState();
};
const closePeerConnectionAndResetState = () => {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  // active mic and camera
  if (
    connectedUserDetails.callType === constants.callType.VIDEO_PERSONAL_CODE ||
    constants.callType.VIDEO_STRANGER
  ) {
    store.getState().localStream.getVideoTracks()[0].enabled = true;
    store.getState().localStream.getAudioTracks()[0].enabled = true;
  }
  ui.updateUIAfterHangUp(connectedUserDetails.callType);
  setIncomingCallsAvailable();
  connectedUserDetails = null;
};
const checkCallPossibility = (callType) => {
  const callState = store.getState().callState;
  if (callState == constants.callState.CALL_AVAILABLE) {
    return true;
  }
  if (
    (callType === constants.callType.VIDEO_PERSONAL_CODE ||
      callType === constants.callType.VIDEO_STRANGER) &&
    callState === constants.callState.CALL_AVAILABLE_ONLY_CHAT
  ) {
    return false;
  }
  return false;
};

const setIncomingCallsAvailable = () => {
  const localStream = store.getState().localStream;
  if (localStream) {
    store.setCallState(constants.callState.CALL_AVAILABLE);
  } else {
    store.setCallState(constants.callState.CALL_AVAILABLE_ONLY_CHAT);
  }
};
