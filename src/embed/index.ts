/**
 * The embed bundle (dist/embed/orb.js, global `OrbEmbed`): everything needed to put the orb on any
 * page with one script tag, give it a brain, and let it drive.
 *
 *   <script src="orb.js"></script>
 *   <script>
 *     const brain = OrbEmbed.httpChatBrain({ url: '/api/chat', model: 'my-model' });
 *     brain.drive = OrbEmbed.driveWith(OrbEmbed.chatPlanner(brain));
 *     OrbEmbed.mountOrb({ brain });
 *   </script>
 */
export { mountOrb, type MountOptions, type MountedOrb } from './mount';
export { orbSay, orbNote, orbThink, orbHome, orbRun, onOrbAct } from '../orb/events';
export { runPilot, driveWith, chatPlanner, needsConfirm, safeUrl, describePage, toStep, parseStepText } from '../pilot';
export { httpChatBrain, localChatBrain, webSpeech } from '../brains';
