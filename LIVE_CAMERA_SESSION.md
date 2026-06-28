# Remy Live Camera Guide

This guide explains what happens during Remy's live camera cooking mode and how to use it.

## What Remy Does During A Live Session

- Shows the current recipe step over a live camera view.
- Tracks your hands in the browser using MediaPipe.
- Watches for hand presence, hand steadiness, grip shape, basic cooking motions, and camera movement.
- Gives visual coaching in the live coach bubble.
- Reads steps and important coaching aloud when sound is on.
- Lets you control the session hands-free with simple gestures.
- Supports pause/resume, repeat instruction, step navigation, and step timers.
- Keeps live video on-device. Live camera frames are not uploaded to the backend.

## Hands-Free Gesture Controls

Use one steady hand in frame. Hold the gesture briefly until Remy confirms it.

| Gesture | What It Does | How To Do It |
| --- | --- | --- |
| Open palm | Pause or resume cooking | Hold an open palm steady in frame. |
| Thumbs up | Go to the next step | Curl your fingers and hold a clear thumbs up. |
| Pinch | Repeat the current step aloud | Pinch thumb and index finger together. |

When a gesture is recognized, Remy shows a short confirmation such as:

- `Gesture: Paused`
- `Gesture: Resumed`
- `Gesture: Next step`
- `Gesture: Repeating step`

Gestures have cooldowns so holding a pose does not trigger the same action repeatedly.

## Automatic Detection

Remy currently detects hands, not food.

### Hand Tracking

Remy detects:

- Whether your hands are visible.
- How many hands are in frame.
- Whether tracking is steady enough to coach.

What you may see or hear:

- `Show me your hands`
- `Bring your hands into frame so I can follow along.`
- `Hold steady for a second so I can lock on to your hands.`
- `Tracking locked`

### Grip Shape

Remy watches the shape of your fingers, especially during chopping steps.

Remy can detect:

- Curled fingers, like a safer claw grip.
- Extended fingers, which can be risky during knife work.
- Partial grip, where fingers are not fully tucked.

What Remy may say:

- `Careful, your fingertips are pointing out.`
- `Curl them under so your knuckles face the blade.`
- `That claw grip is spot on.`

Important limit: Remy does not directly see a knife. It uses the recipe step plus your hand shape to decide when to coach knife safety.

### Cooking Motion

Remy estimates simple hand motions:

- Chopping
- Stirring
- Transferring or flipping
- Seasoning
- Kneading or prep motions
- Idle hands

What Remy may say:

- `Keep stirring.`
- `That is a steady stir.`
- `That does not look like this step.`
- `Ready when you are.`

These motion checks are basic and may miss real cooking movements.

### Camera Movement

Remy watches whether the camera itself is moving too much.

What Remy may say:

- `The camera is moving too much.`
- `Prop the phone up or hold it steady so I can see your hands.`

If the camera is moving, Remy avoids trusting some hand-motion signals.

## Spoken Coaching

Use the sound button in live mode to turn speech on or off.

When sound is on, Remy can speak:

- The current recipe step when the step changes.
- Safety warnings.
- Tracking and camera warnings.
- Useful cooking tips.
- Positive feedback when your motion or grip matches the step.

Example step speech:

```text
Step 3. Stir the sauce. Stir until glossy and thickened.
```

Urgent messages can interrupt current speech, especially:

- Safety warnings.
- Camera movement warnings.
- Lost-hand or tracking warnings.
- Step changes.

Normal tips are throttled so Remy does not constantly talk over itself.

## Quiet Mode

Use quiet mode when you want fewer spoken tips.

In quiet mode:

- Step changes are still spoken.
- Safety and important warnings are still spoken.
- Normal tips and praise stay visual only.

## Repeat Instruction

You can repeat the current step in two ways:

- Tap the repeat button in live mode.
- Use the pinch gesture.

Remy repeats the current step aloud if sound is on.

## Timers

Some recipe steps show a suggested timer.

When available, you can:

- Tap `Set timer`.
- Watch the countdown in live mode.
- Hear a short ding when the timer finishes, if browser audio is available.

Timers are local to the current live session.

## Pause And Resume

You can pause live cooking by:

- Tapping the pause button.
- Holding the open-palm gesture.

While paused:

- The session timer stops.
- Coaching updates stop.
- The camera view stays open.

## Current Limits

- Web live mode has real hand tracking. Native live mode is only a fallback screen right now.
- Remy does not detect ingredients, food doneness, heat, steam, smoke, pans, utensils, or knives directly.
- Gestures work best with one steady hand in frame.
- Gesture detection favors missing a gesture over accidentally triggering one.
- Browser speech behavior can vary by browser and may require a user interaction first.
- Live camera frames stay on-device and are not sent to the backend.
