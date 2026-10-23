/**
 * Ready-made brains for the orb. Nothing here is required: the orb runs with `brain={null}`.
 *
 *   const brain = { ...httpChatBrain({ url, model }), ...webSpeech() };
 *   brain.drive = driveWith(chatPlanner(brain));   // and now it can navigate too (src/pilot)
 *
 * Never put a secret key in page code: proxy it (the Orb Browser keeps it in its main process).
 */
export { httpChatBrain } from './httpChat';
export { localChatBrain } from './localChat';
export { webSpeech, canSpeak, canListen, createSpeaker, speakable, unlockSpeech, listen } from './webSpeech';
