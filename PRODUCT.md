# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Primary: the owner, a 1st-year student of the Spanish vocational degree TSAPC (Técnico Superior en Anatomía Patológica y Citodiagnóstico). Studies mostly on the phone: on the bus, at night, and in short 10–20 minute sessions, especially in the week before an exam.
- Secondary (likely, not yet confirmed): the rest of the class, about 23 people, opening the same link. Each one needs a personal space with their own progress on their own device.
- Phones: both iPhone (Safari) and Android (Chrome). Any feature missing on one (vibration, install prompt) must have a fallback.

## Product Purpose

A study app for the course units: a summary to review («repaso»), practice exams («simulacro»), flashcards, vocabulary and tests per unit, plus the original PDFs. Success means walking into an exam knowing what has been mastered and what still fails, without wasting the short study windows.

## Positioning

Made by and for one histotechnology class, built on its own syllabus and slides, with study tools tuned to how this course is examined. The new identity, «Corte», borrows the language of the histology lab the students are training for.

## Operating Context

- Short sessions on a phone, often offline or on a weak connection.
- Exam weeks drive usage: one subject at a time, with a fixed date.
- Content follows the teacher's slides («diap. N»), in the same order as the PowerPoint.
- The course will grow to 2nd year later; for now everything is 1st year. The structure must allow more courses and units without renumbering.

## Capabilities and Constraints

- Static PWA: HTML, CSS and JavaScript, no framework and no build step. Hosted from GitHub (ArpusEdu/tsapc).
- No accounts and no server: progress lives on each device (localStorage), with export and import of a backup. Personal space = per-device data.
- Must work offline after the first visit, including images.
- 12 units in 1st year: bio1-3, fisio1-3, gest1-2, ingles1, ipe-tema5, ipe2, lab1.
- Nothing that costs money: no paid services, fonts, components or APIs.
- Academic content (questions, answers, syllabus) is not edited during redesign.
- No progress data may be lost; old storage keys are migrated, never deleted without asking.
- PDFs in files/ are not compressed.
- Exam dates are not known yet: editable by the student, shown as «Fecha por confirmar» until set.

## Brand Commitments

- Name: **Corte**, signature «corte · 4 µm» (decided by the owner on 2026-11-02).
- Voice: a veteran lab technician. Precise, brief, warm, with real histotechnology vocabulary. Never childish, never guilt-inducing, no gamification (no coins, rankings or confetti).
- Spanish (Spain) throughout; the English unit keeps its English content.

## Evidence on Hand

- 33 pages of real content: per-unit repasos and simulacros, vocabulary and tests (paths in the repo root).
- Histology images inside the repasos, with alt text and slide references.
- Original PDFs in files/ (28 MB).
- No testimonials, statistics or third-party claims exist; none must be invented.

## Product Principles

1. The next useful step first: open the app and know what to do in three seconds.
2. Progress comes from what you got right, not from boxes you ticked.
3. Mistakes come back: every miss turns into future practice, never into a punishment.
4. Works on the bus: offline, fast on 4G, one thumb.
5. Your data is yours: on your device, exportable, never lost in an update.

## Accessibility & Inclusion

WCAG 2.2 AA in both light and dark themes; touch targets of at least 44 px; `prefers-reduced-motion` respected; state never shown by colour alone.
