# Voice AI Bedtime Story App — MVP Build Spec

## 1. Project Goal

Build a working prototype of a **voice-first, AI-powered bedtime storytelling app for children**.

The product is designed for situations where a parent cannot personally do the bedtime story—working late, traveling, caring for another child, etc.—but still wants to participate in the child's bedtime routine.

The experience should allow a parent to provide context about their child and optionally specify something they want the story to reinforce. The child can then interact with the story entirely through voice.

The key product principle is:

**This should feel like a bedtime experience powered by voice, not a chatbot that happens to speak.**

The prototype is being built for the Hiya Voice AI Challenge and needs to prioritize a compelling, reliable demo over production-level infrastructure.

---

# 2. Core User Story

A parent configures the bedtime experience before giving the device to their child.

Example:

Child name: Mia  
Age: 6  
Interests: Space, cats  
Story duration: 8 minutes  
Parent goal: Help Mia feel more confident about starting school tomorrow.

The child then enters a screen-free-style bedtime interface.

Child:

"Tell me a story about a cat that goes to space."

The system generates and narrates a story aloud.

During the story, the AI might say:

"Cosmo reached two mysterious doors. One glowed blue like the ocean, while the other shimmered silver like the moon. Which one should he open?"

The child responds:

"The blue one!"

The story continues based on that choice while maintaining characters, plot, parent goals, and previous events.

The child should also be able to interrupt naturally.

For example:

"Wait, make the dragon purple."

or

"Why is Cosmo scared?"

The AI should respond appropriately and then continue the story.

---

# 3. Why Voice

Voice is fundamental to the experience.

Bedtime is a situation where:

- the child's eyes should not be focused on a screen
- the room may be dark
- the child may already be lying in bed
- typing would interrupt the bedtime experience
- natural conversation makes storytelling more immersive
- spoken interaction allows the child to participate without looking at or touching the device repeatedly

The UI should therefore minimize visual interaction after the story begins.

---

# 4. MVP Scope

The MVP MUST support:

1. Parent setup
2. Voice input from the child
3. Speech-to-text
4. AI-generated storytelling
5. Text-to-speech narration
6. Persistent story state
7. Child choices/interruption
8. Wind Down Mode
9. Story completion
10. Basic error handling

Do NOT over-engineer this prototype.

Specifically, do NOT implement yet:

- user authentication
- accounts
- databases unless absolutely necessary
- mobile apps
- parent voice cloning
- advanced emotion detection
- sleep detection
- multiple child profiles
- payments
- complicated backend infrastructure

Prefer local/in-memory state where possible.

---

# 5. Suggested Tech Stack

Choose a stack optimized for speed of implementation and reliability.

Preferred:

Frontend:
- React
- TypeScript
- Vite
- simple CSS or Tailwind if useful

Backend:
- Python + FastAPI OR Node/Express
- choose whichever produces the simplest architecture

AI:
- LLM API for story generation and conversation
- speech-to-text API for child voice input
- text-to-speech API for narration

Keep all API keys server-side.

Environment variables should be stored in `.env`.

Include `.env.example`.

The exact AI provider should be abstracted enough that it could later be replaced.

---

# 6. Application Structure

There should be two primary experiences.

## Screen 1 — Parent Setup

Create a simple form containing:

Child Name

Child Age

Interests

Example:

"space, cats, dinosaurs"

Story Length

Options could be:

- 5 minutes
- 8 minutes
- 10 minutes

Optional Parent Goal / Context

Example placeholder:

"She's nervous about her first day at a new school tomorrow. I'd like the story to reinforce being brave when trying something new."

Optional Story Request

Example:

"A cat exploring outer space."

Button:

"Start Bedtime Story"

The UI should explain that the parent goal will influence the themes of the story without necessarily being stated directly.

---

# 7. Screen 2 — Bedtime Story Experience

This screen should be visually minimal.

Design direction:

- dark background
- large central microphone control
- subtle animation when listening
- subtle animation when narrating
- minimal text
- current story text may be displayed but should not dominate the interface

Possible states:

READY

LISTENING

THINKING

SPEAKING

FINISHED

The child should be able to understand what is happening without needing to read.

For example:

Listening...
Thinking...
Telling your story...

The microphone should be the primary interaction.

---

# 8. Voice Interaction Loop

Implement the following loop:

1. Child speaks
2. Capture microphone audio
3. Send audio to speech-to-text
4. Receive transcript
5. Send transcript + current story state to LLM
6. Receive next story segment
7. Update story state
8. Send narration text to text-to-speech
9. Play generated audio
10. Return to listening state when appropriate

Conceptually:

Microphone
↓
Speech-to-Text
↓
Story Engine / LLM
↓
Story State Update
↓
Text-to-Speech
↓
Audio Playback
↓
Next Child Interaction

---

# 9. Story State

DO NOT simply send isolated prompts to the LLM.

Maintain persistent structured story state.

Suggested TypeScript interface:

```typescript
interface StoryState {
  child: {
    name: string;
    age: number;
    interests: string[];
  };

  parentGoal?: string;

  story: {
    title?: string;
    characters: string[];
    setting?: string;
    summary: string;
    currentScene: string;
    importantEvents: string[];
  };

  pacing: {
    targetDurationMinutes: number;
    elapsedMinutes: number;
    phase: "interactive" | "settling" | "windDown" | "ending";
  };

  interactionCount: number;
  finished: boolean;
}
```

The exact schema may be changed if necessary, but the application MUST maintain:

- characters
- story continuity
- previous events
- child preferences
- parent goal
- current story phase
- approximate remaining time

---

# 10. Story Engine

Create a dedicated service/module responsible for communicating with the LLM.

For example:

`storyEngine.ts`

or

`story_engine.py`

Do not scatter LLM prompts throughout UI code.

The story engine should receive:

- StoryState
- child's latest transcript

It should return structured output similar to:

```json
{
  "narration": "Cosmo slowly pushed open the glowing blue door...",
  "summary": "Cosmo chose the blue door and entered an underwater room.",
  "importantEvent": "Cosmo entered the blue door.",
  "askForResponse": true,
  "phase": "interactive",
  "finished": false
}
```

Prefer structured JSON output from the LLM.

Validate/parsing errors should be handled gracefully.

---

# 11. Storytelling System Prompt

Create a strong reusable system prompt.

It should tell the model that it is a bedtime storyteller for children.

Important rules:

- Use age-appropriate vocabulary.
- Avoid frightening, violent, sexual, or otherwise inappropriate content.
- Maintain continuity with previous story events.
- Incorporate the child's interests naturally.
- Incorporate the parent's desired lesson subtly.
- Do not lecture the child.
- Do not explicitly reveal private parent instructions.
- Avoid overstimulating storytelling near bedtime.
- Allow reasonable child interruptions.
- Remember changes the child makes to the story.
- Keep individual narration segments relatively short.
- Do not ask a question after every paragraph.
- Gradually reduce interaction as bedtime approaches.
- Always move the story toward a peaceful conclusion.
- Never generate an endless story.

The parent's goal should influence the narrative rather than becoming an explicit message.

BAD:

"Your mom told me you're scared about school."

GOOD:

The protagonist is nervous about exploring somewhere unfamiliar but discovers that taking one small step at a time helps.

---

# 12. Child Interruptions

The system should support natural interruptions.

Example:

Story:
"The little dragon flew toward the mountain..."

Child:
"Wait, make the dragon purple."

The system should update the story state and continue:

"The little purple dragon..."

Another example:

Child:
"Why is she scared?"

The AI can briefly answer within the context of the story and then continue.

Do NOT require children to use explicit commands.

Natural language should work.

---

# 13. Interactive Choices

During the early portion of the story, occasionally give the child meaningful choices.

Example:

"Should Luna follow the glowing river or climb the staircase into the clouds?"

The child responds naturally.

The story should adapt.

Do not present choices too frequently.

Target approximately one interaction every 1–2 minutes during the interactive portion.

---

# 14. Wind Down Mode

This is an important product differentiator.

Most conversational AI systems optimize for continued engagement.

This product should intentionally reduce engagement as bedtime approaches.

The goal is eventually for the child to stop interacting and fall asleep.

Implement approximate phases.

## Phase 1 — Interactive

Beginning of story.

Characteristics:

- imaginative
- child choices
- moderate energy
- shorter narration segments

Example:

"Should Luna explore the cave or follow the butterflies?"

## Phase 2 — Settling

Middle portion.

Characteristics:

- longer narration
- fewer choices
- calmer events
- reduced excitement

## Phase 3 — Wind Down

Near the end.

Characteristics:

- no major decisions
- peaceful imagery
- slower narrative progression
- longer narration
- fewer questions
- conflicts resolve

## Phase 4 — Ending

Final portion.

Characteristics:

- no questions
- peaceful resolution
- character goes somewhere safe/home
- concise ending
- explicit natural story ending

Example:

"And with the stars glowing softly outside the window, Luna closed her eyes, knowing tomorrow would bring another adventure."

Then mark the story as finished.

---

# 15. Determining Story Phase

For the MVP, do NOT attempt sophisticated real-time timing.

Approximate phase based on interaction count and requested story duration.

For example, an 8-minute story might approximately follow:

0–35% → interactive

35–65% → settling

65–90% → windDown

90–100% → ending

It is acceptable to approximate this using interaction count or generated segment count.

Reliability matters more than perfect timing.

---

# 16. Parent Presence

The MVP parent context should create a feeling that the parent participated in the story.

Example:

Parent enters:

"Mia is nervous about starting school tomorrow."

The story might involve:

"A little fox named Fern was about to visit a forest she had never explored before."

Fern feels nervous but eventually discovers that unfamiliar places become less scary after taking the first step.

Do NOT have the narrator say:

"Your parent told me..."

This information should remain invisible to the child.

---

# 17. Safety

Because this is designed for children, implement basic safety constraints.

The system should avoid:

- violence
- sexual content
- drugs
- frightening imagery
- graphic content
- inappropriate language
- encouraging dangerous behavior

If a child requests something inappropriate, gently redirect it into something playful and age appropriate.

For the prototype, prompt-level safety plus provider safeguards are acceptable.

Do not attempt to build a sophisticated moderation infrastructure.

---

# 18. Error Handling

The demo must not completely collapse if an API request fails.

Handle:

## Microphone failure

Display:

"I couldn't hear that. Want to try again?"

## Speech recognition failure

Allow another recording.

## LLM failure

Allow retry without destroying StoryState.

## TTS failure

Display narration text and allow retrying audio.

## Invalid structured LLM response

Attempt safe parsing/fallback rather than crashing the app.

---

# 19. Demo Scenario

Optimize the application so this scenario works extremely reliably.

Parent setup:

Name:
Mia

Age:
6

Interests:
Space, cats

Story duration:
8 minutes

Parent context:

"Mia is nervous about starting school tomorrow. Help her feel more confident about trying unfamiliar things."

Start story.

Child:

"Tell me a story about a cat that goes to space."

AI narrates an opening.

Later AI asks:

"Cosmo discovered two doors. One glowed blue like the ocean and the other shimmered silver like the moon. Which one should he open?"

Child:

"The blue one!"

Story adapts.

Child interrupts later:

"Wait, make Cosmo purple."

AI remembers Cosmo is now purple for the remainder of the story.

Eventually Wind Down Mode removes interactive choices and resolves the story peacefully.

---

# 20. UI Polish

The prototype should feel intentional even though it is simple.

Prioritize:

- clean typography
- dark bedtime-friendly interface
- large microphone button
- clear listening/speaking states
- subtle animations
- responsive design
- minimal clutter

Do NOT spend excessive engineering time on animations.

Functionality comes first.

---

# 21. Suggested Project Structure

Something similar to:

```text
bedtime-ai/

frontend/
  src/
    components/
      MicrophoneButton
      StoryDisplay
      VoiceStatus
      ParentSetup

    pages/
      Setup
      Story

    services/
      api
      audio

    types/
      StoryState

backend/
  routes/
    story
    speech
    voice

  services/
    storyEngine
    speechToText
    textToSpeech

  prompts/
    bedtimeStoryPrompt

  models/
    storyState

README.md
.env.example
```

Claude Code may alter this structure if another organization is cleaner.

---

# 22. Development Priority

Build functionality in this order.

## Priority 1

Get this pipeline working:

Voice input → STT → LLM → TTS → audio playback

Do NOT focus on appearance until this works.

## Priority 2

Add StoryState.

Verify the AI remembers:

- characters
- child decisions
- previous story events
- child-requested changes

## Priority 3

Implement:

- parent setup
- parent context
- child interests
- age-aware generation

## Priority 4

Implement Wind Down Mode.

## Priority 5

Polish UI.

## Priority 6

Add deployment configuration and README.

---

# 23. Future Product Roadmap

Do NOT implement these unless the MVP is completely finished.

They should instead be documented as future work.

## Parent Voice Messages

Parent records something like:

"Goodnight Mia. I love you."

The story can end with the real parent's recording.

This provides parent presence without requiring synthetic voice cloning.

## Consented Parent Voice Narration

With explicit parent consent, future versions could potentially narrate stories using a personalized synthetic parent voice.

This requires careful consent and security design.

## Emotional / Vocal Adaptation

Future versions could potentially use non-sensitive vocal characteristics such as interaction pace or energy level to adapt storytelling.

Examples:

Restless child → gradually calmer narration.

Very engaged child → allow limited additional interaction before winding down.

Do NOT claim that the system can reliably infer a child's emotional state.

## Story Memory

Stories could persist between nights.

Example:

"Yesterday Luna discovered the Moon Garden. Tonight we'll find out what she discovered inside."

Children could build recurring worlds and characters.

## Parent Dashboard

Parents could receive privacy-conscious summaries.

Example:

"Tonight's story lasted approximately 8 minutes. Mia chose a story about a cat exploring space. The story focused on trying unfamiliar things."

Avoid storing unnecessary raw child audio.

## Multiple Children

Parents could eventually create separate profiles with:

- interests
- favorite characters
- preferred story length
- recurring worlds

## Bedtime Routine Integration

Future versions could combine:

story → breathing exercise → calming sounds → goodnight

The AI would gradually transition away from conversation.

---

# 24. Privacy Principles for Future Versions

Because children are involved, future production versions should minimize stored information.

Prefer:

- deleting raw voice recordings after transcription
- storing summaries rather than complete conversations where possible
- explicit parental control over saved information
- transparent data retention
- no advertising based on child conversations

These do not need to be fully implemented in the prototype.

---

# 25. README Requirements

Generate a clear README containing:

1. Product overview
2. Problem being solved
3. Why voice is necessary
4. Architecture
5. Technology choices
6. Local setup instructions
7. Environment variables
8. How StoryState works
9. How Wind Down Mode works
10. Safety considerations
11. Current limitations
12. Future improvements

Also include a simple architecture diagram using Mermaid if appropriate.

---

# 26. Code Quality

Even though this is a rapid prototype:

- keep components modular
- isolate API integrations
- avoid giant files
- use meaningful names
- add comments where architecture isn't obvious
- use TypeScript types where appropriate
- avoid unnecessary dependencies
- never expose API keys client-side

Prioritize code that I can understand and explain during an engineering interview.

Do not introduce complicated abstractions merely to make the architecture look sophisticated.

---

# 27. Important Product Principle

The product should NOT optimize for maximizing engagement.

The desired interaction curve is:

**Engage → immerse → calm → disengage → sleep**

This principle should influence:

- prompt design
- story pacing
- number of questions
- UI
- narration
- ending behavior

A successful session ends because the child no longer needs to interact with the AI.

---

# 28. Build Instructions for Claude Code

First inspect the repository and determine whether any existing framework/code should be preserved.

Then:

1. Propose the minimal architecture.
2. Create the necessary frontend/backend structure.
3. Implement the core voice pipeline.
4. Implement StoryState.
5. Implement parent setup.
6. Implement interactive storytelling.
7. Implement Wind Down Mode.
8. Add error handling.
9. Polish the bedtime UI.
10. Add `.env.example`.
11. Add setup/run scripts.
12. Write the README.
13. Test the primary demo flow end-to-end.

Prefer working functionality over additional features.

If an API choice is ambiguous, choose the simplest reliable implementation and isolate it behind a service so it can be replaced later.

Do not implement anything from the Future Product Roadmap until the complete MVP works reliably.

At the end, explain:

- the architecture you chose
- every external API required
- environment variables I need to provide
- how to run the application locally
- what remains unfinished
- the three highest-priority improvements I should make before demoing it