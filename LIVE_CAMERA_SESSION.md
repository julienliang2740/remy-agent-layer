# Remy Live Camera Guide

This guide explains what happens during Remy's live camera cooking mode and how to use it.

## What Remy Does During A Live Session

- Shows the current recipe step over a live camera view.
- Tracks your hands in the browser using MediaPipe.
- Watches for hand presence, hand steadiness, grip shape, and basic cooking motions.
- Gives visual coaching in the live coach bubble.
- Speaks the current step and repeated step instructions when sound is on.
- Lets you control the session hands-free with simple gestures.
- Supports pause/resume, repeat instruction, step navigation, and step timers.
- Keeps live video on-device. Live camera frames are not uploaded to the backend.

## Hands-Free Gesture Controls

Use one steady hand in frame. Hold the gesture briefly until Remy confirms it.
Tap the `?` button in live mode to open or close this reminder.

| Gesture | What It Does | How To Do It |
| --- | --- | --- |
| Open palm | Pause or resume cooking | Hold an open palm steady in frame. |
| Thumbs up | Go to the next step | Curl your fingers and hold a clear thumbs up. |
| Pinch | Repeat the current step | Pinch thumb and index finger together. |

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

- Whether both hands are visible.
- How many hands are in frame.
- Whether tracking is steady enough to coach.

What you may see:

- `Show me your hands`
- `I can't see your hands. Bring both hands into frame.`
- `I can only see one hand. Bring both hands into frame when you can.`
- `Hold steady for a second so I can lock on to your hands.`
- `Tracking locked`

These prompts are visual only right now.

### Grip Shape

Remy watches the shape of your fingers, especially during chopping steps.

Remy can detect:

- Curled fingers, like a safer claw grip.
- Extended fingers, which can be risky during knife work.
- Partial grip, where fingers are not fully tucked.

What Remy may show:

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

What Remy may show:

- `Keep stirring.`
- `That is a steady stir.`
- `That does not look like this step.`
- `Ready when you are.`

These motion checks are basic and may miss real cooking movements.

## Spoken Coaching

Spoken coaching is intentionally limited right now.

Remy speaks:

- Step changes.
- Repeated step instructions from the repeat button or pinch gesture.

Remy does not currently speak:

- Hand placement reminders.
- Camera reminders.
- Safety tips.
- General cooking tips.
- Positive feedback.

## Quiet Mode

Quiet mode is currently disabled with spoken coaching.

## Repeat Instruction

You can repeat the current step in two ways:

- Tap the repeat button in live mode.
- Use the pinch gesture.

Repeat shows a visual confirmation and repeats the current step aloud when sound is on.

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
- Spoken coaching is limited to step narration and repeat.
- Live camera frames stay on-device and are not sent to the backend.
