# SpiSnap
Academic Performance Tracker

<div align="center">

SpiSnap

Track. Understand. Improve.

A lightweight academic performance tracker for managing SPI, CGPA, semester progress, backlogs, and student records from one unified dashboard.

<p>
  <a href="https://sipsnap.netlify.app/"><strong>🌐 Live Demo</strong></a>
  &nbsp; · &nbsp;
  <a href="[GITHUB_REPOSITORY_URL]"><strong>GitHub Repository</strong></a>
  &nbsp; · &nbsp;
  <a href="[PORTFOLIO_URL]"><strong>Portfolio</strong></a>
</p>

<img src="https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white" alt="HTML5">
<img src="https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white" alt="CSS3">
<img src="https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?style=flat-square&logo=javascript&logoColor=111111" alt="Vanilla JavaScript">
<img src="https://img.shields.io/badge/PWA-Installable-5A0FC8?style=flat-square" alt="PWA">
<img src="https://img.shields.io/badge/Responsive-Yes-2B7A78?style=flat-square" alt="Responsive">

</div>

Overview

SpiSnap is a focused academic performance dashboard built for students, mentors, team leaders, and academic teams.

It brings student records, semester-wise SPI, CGPA, backlogs, academic status, search, filtering, sorting, analytics, and CSV data management into one practical interface.

The goal is simple: make academic performance easier to record, review, and understand without depending on scattered spreadsheets.

Preview

Dashboard

<div align="center">
  <img src="assets/screenshots/dashboard.png" width="900" alt="SpiSnap Dashboard">
</div>

<p align="center">
  <strong>Centralized academic dashboard</strong><br>
  View student performance, SPI, CGPA, backlogs, and academic progress from one place.
</p>

Mobile Experience

<div align="center">
  <img src="assets/screenshots/mobile.png" width="360" alt="SpiSnap Mobile Experience">
</div>

<p align="center">
  <strong>Responsive mobile experience</strong><br>
  Designed to remain practical and easy to use on smaller screens.
</p>

Features

Feature

Description

Student Records

Add, edit, view, and manage student academic records

SPI Tracking

Track semester-wise SPI

CGPA Monitoring

Monitor current/overall CGPA

Semester Progress

Review academic progress across semesters

Backlog Tracking

Track semester backlogs

Academic Status

Maintain semester-wise academic status

Search

Quickly find student records

Filtering

Filter student records

Sorting

Sort academic records

Analytics

Review academic performance insights

CSV Import

Import student data from CSV

CSV Export

Export student records to CSV

IndexedDB

Persistent local browser storage

LocalStorage Fallback

Fallback storage when IndexedDB is unavailable

Offline Support

Continue using the app with local data when supported

PWA

Install SpiSnap like an application

Responsive UI

Designed for mobile, tablet, laptop, and desktop

Tech Stack

SpiSnap keeps the architecture lightweight and dependency-free.

HTML5 — semantic application structure

CSS3 — responsive UI and visual system

Vanilla JavaScript — application logic and interactions

IndexedDB — persistent local student data

LocalStorage — fallback local persistence

Web App Manifest — installable PWA metadata

Service Worker — offline application shell

PWA APIs — app-like installation and behavior

Netlify — live deployment

No frontend framework is required.

How It Works

User
  ↓
SpiSnap Dashboard
  ↓
Student Records
  ↓
IndexedDB
  ↓
LocalStorage Fallback
  ↓
Search / Filter / Sort
  ↓
Analytics
  ↓
CSV Import / Export

Student information is handled locally by the application according to the current implementation. SpiSnap does not require a cloud database for its core local-record workflow.

Student Record

The student record model includes semester-wise academic information such as:

enrollment
name

semester 1
├── SPI
├── backlog
└── status

semester 2
├── SPI
├── backlog
└── status

semester 3
├── SPI
├── backlog
└── status

semester 4
├── SPI
├── backlog
└── status

current CGPA

The implementation should remain compatible with the existing SpiSnap data model.

Local Storage & Offline Support

SpiSnap is designed around client-side storage.

IndexedDB

Student records are primarily persisted using IndexedDB.

LocalStorage Fallback

A LocalStorage fallback is available where required by the application.

Service Worker

The service worker provides the offline application shell required for the PWA experience.

No Cloud Sync

The current application should not be described as having cloud synchronization or server-side student data storage unless such functionality is added separately.

PWA

SpiSnap can be packaged as an installable Progressive Web App.

The repository includes:

manifest.webmanifest
service-worker.js

The PWA setup covers:

Standalone display

Application theme color

Background color

Application icons

Offline application shell

Browser installability where supported

Responsive Design

SpiSnap is designed to work across a broad range of screen sizes, including:

320px mobile

375px mobile

414px mobile

768px tablet

1024px laptop/tablet

1440px desktop

1920px desktop

2560px large displays

The interface focuses on:

Responsive dashboard cards

Responsive student records

Responsive modals

Touch-friendly controls

Mobile-friendly toolbar

Responsive footer

Practical PWA/mobile usage

Avoiding intentional horizontal overflow

Accessibility

The interface is designed with accessibility in mind, including:

Semantic HTML

Form labels

Keyboard-friendly interactions

Modal focus management

ESC-based modal closing

Accessible controls

Readable contrast

Reduced-motion support

Accessibility should be preserved when extending the application.

Installation

1. Clone the repository

git clone [GITHUB_REPOSITORY_URL]
cd SpiSnap

2. Run a local HTTP server

For example, with Python:

python -m http.server 8000

3. Open SpiSnap

http://localhost:8000

A local HTTP server is recommended because service workers generally require a secure context such as HTTPS or localhost.

Netlify Deployment

SpiSnap is deployed on Netlify.

Live Application

https://sipsnap.netlify.app/

Deploy

Push the project to GitHub.

Sign in to Netlify.

Import the GitHub repository.

Select the repository.

For this vanilla HTML/CSS/JS project, no framework build step is required unless one is introduced later.

Deploy the site.

Verify the PWA, service worker, assets, and screenshots after deployment.

Do not commit Netlify credentials, API keys, or environment secrets.

Project Structure

SpiSnap/
│
├── index.html
├── style.css
├── script.js
│
├── manifest.webmanifest
├── service-worker.js
│
├── favicon.png
├── apple-touch-icon.png
│
├── assets/
│   ├── icons/
│   │   ├── icon-72.png
│   │   ├── icon-96.png
│   │   ├── icon-128.png
│   │   ├── icon-144.png
│   │   ├── icon-152.png
│   │   ├── icon-192.png
│   │   ├── icon-384.png
│   │   └── icon-512.png
│   │
│   └── screenshots/
│       ├── dashboard.png
│       └── mobile.png
│
├── .github/
│   ├── workflows/
│   │   └── deploy.yml
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   ├── feature_request.md
│   │   └── improvement.md
│   └── pull_request_template.md
│
├── README.md
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── SECURITY.md
├── LICENSE
├── CHANGELOG.md
└── .gitignore

Repository Screenshots

Only two application screenshots are used in this repository:

assets/screenshots/dashboard.png
assets/screenshots/mobile.png

These should be real screenshots of SpiSnap.

Do not replace them with generated or misleading UI images.

Contributing

Contributions, fixes, documentation improvements, and thoughtful feature suggestions are welcome.

Basic workflow:

Fork
  ↓
Create a branch
  ↓
Make changes
  ↓
Test locally
  ↓
Check responsive behavior
  ↓
Check browser console
  ↓
Commit
  ↓
Open Pull Request

Recommended branch naming:

feature/...
fix/...
docs/...
refactor/...

Please preserve existing functionality when making changes.

Security

SpiSnap primarily uses client-side/local browser storage for its current local-data workflow.

Because browser storage is local to the user's environment, users should avoid storing highly sensitive personal information unless they understand the storage and privacy implications.

For security-related reports:

[SECURITY_CONTACT]

Please do not publish credentials, API keys, private data, or other secrets in issues or pull requests.

Roadmap

Possible future improvements may include:

Expanded academic analytics

Additional export formats

More customization options

Further accessibility improvements

Additional PWA enhancements

These are future possibilities and are not presented as existing functionality.

Branding

SpiSnap's visual identity is based on a clean academic + technology aesthetic.

Token

Value

Primary Dark

#17252A

Primary

#2B7A78

Accent

#3AAFA9

Background

#DEF2F1

Surface

#FFFFFF

The repository documentation should stay aligned with this visual identity.

License

This project is intended to use the MIT License.

Before publishing, replace:

[YOUR NAME]

with the actual copyright holder name.

Changelog

See CHANGELOG.md for project changes.

Current development status:

Unreleased

Initial SpiSnap repository documentation

PWA documentation

GitHub repository structure

Application screenshots

Links

Resource

Link

Live App

https://sipsnap.netlify.app/

GitHub

[GITHUB_REPOSITORY_URL]

Instagram

[INSTAGRAM_URL]

LinkedIn

[LINKEDIN_URL]

Portfolio

[PORTFOLIO_URL]

Email

[EMAIL_ADDRESS]

<div align="center">

SpiSnap

Track. Understand. Improve.

Built with care for students, mentors, and academic teams.

<br>

<a href="https://sipsnap.netlify.app/"><strong>Open SpiSnap →</strong></a>

</div>
