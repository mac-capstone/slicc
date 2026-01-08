# COMPSCI 4ZP6A Meeting Notes

## Table of Contents

- [September 3, 2025 - First Meeting](#september-3-2025---first-meeting)
- [September 15, 2025 - Second Meeting](#september-15-2025---second-meeting)
- [September 19, 2025 - Third Meeting](#september-19-2025---third-meeting)
- [October 4, 2025 - Fourth Meeting](#october-4-2025---fourth-meeting)
- [October 9, 2025 - Fifth Meeting](#october-10-2025---fifth-meeting)
- [October 23, 2025 - Sixth Meeting](#october-23-2025---sixth-meeting)
- [October 30, 2025 - Seventh Meeting](#october-30-2025---seventh-meeting)
- [November 4, 2025 - Eighth Meeting](#november-4-2025---eighth-meeting)
- [November 6, 2025 - Ninth Meeting](#november-6-2025---ninth-meeting)
- [November 13, 2025 - Tenth Meeting](#november-13-2025---tenth-meeting)

---

## September 3, 2025 - First Meeting

**Attendees:**

- Michael
- Asad
- Viransh
- Jayesh
- Abdul-Hadi
- Eduardo
- Ankush

**Agenda:**

- Discuss potential project ideas including the "Sticky Note" project.
- Review existing project suggestions from the professor.
- Shortlist feasible projects for further consideration.

---

## September 15, 2025 - Second Meeting

**Attendees:**

- Michael
- Asad
- Viransh
- Jayesh
- Abdul-Hadi
- Eduardo
- Ankush

**Agenda:**

- Refine shortlist of project ideas.
- Perform initial feasibility assessment of top 4 projects.
- Ask Professor about the top 4 ideas.

---

## September 19, 2025 - Third Meeting

**Attendees:**

- Michael
- Asad
- Viransh
- Jayesh
- Abdul-Hadi
- Eduardo
- Ankush

**Agenda:**

- Finalize project idea.
- Complete and review the project proposal form.
- Discuss core features and future plan.

---

## October 4, 2025 - Fourth Meeting

**Attendees:**

- Michael
- Asad
- Viransh
- Jayesh
- Abdul-Hadi
- Eduardo
- Ankush

**Agenda:**

- Discuss the SRS and development plan.
- Add complexity to the project idea.
- Research feasibility of the P2P Tap-to-Pay feature.
- Consider pivoting to a restaurant social app with Interac e-transfer, instead of Tap-to-Pay.

---

## October 10, 2025 - Fifth Meeting

**Attendees:**

- Michael
- Asad
- Viransh
- Jayesh
- Abdul-Hadi
- Eduardo
- Ankush

**Agenda:**

- Generalize the project idea to all group outings but keep the restaurant and bill-splitting focus.
- Finish the SRS and development plan.
- Start working on the design starting October 14, 2025.

---

# October 23, 2025 - Sixth Meeting

**Attendees:**

- Michael
- Viransh
- Jayesh
- Ankush

**Agenda:**

- Set up Android Studio for Android build of the app.
- Install necessary SDKs and tools.
- Configure and start project for Android development.
- Start Figma app design.

---

# October 30, 2025 - Seventh Meeting

**Attendees:**

- Michael
- Asad
- Viransh
- Jayesh
- Abdul-Hadi
- Eduardo
- Ankush

**Agenda:**

- Assign specific figma design tasks to team members.
- Finish PoC figma by November 4, 2025.
- Plan next steps for development phase.

---

# November 4, 2025 - Eighth Meeting

**Attendees:**

- Michael
- Asad
- Viransh
- Jayesh
- Abdul-Hadi
- Eduardo
- Ankush

**Agenda:**

- Discuss the project’s code file structure.
- Review React Native and Tailwind CSS best practices.
- Go over all necessary code components, modules, and files for the app.
- Define components, hooks, APIs & queries
- Define color, internationalization for strings (i8n), file routing, and structure.

---

# November 6, 2025 - Ninth Meeting

**Attendees:**

- Michael
- Asad
- Viransh
- Jayesh
- Eduardo
- Ankush

**Agenda:**

- Discuss new code files added since last meeting.
- Split up the app into smaller modules for development according to PoC Figma.
- Assign module creation tasks to team members on Linear.

---

# November 13, 2025 - Tenth Meeting

**Attendees:**

- Michael
- Asad
- Viransh
- Jayesh

**Agenda:**

- Review progress on assigned modules according to PoC Figma and Linear tasks.
- Discuss any challenges faced during development.
- Plan next steps and set deadlines for UImodule completion.

---

# November 19, 2025 - Eleventh Meeting

**Attendees:**

- Michael
- Asad
- Viransh
- Jayesh
- Abdul-Hadi
- Eduardo
- Ankush

**Agenda:**

- Meeting with Professor to discuss project progress.
- Plan next steps based on Professor's input.
- Finish PoC code by November 20, 2025.

---

# November 20, 2025 - Twelfth Meeting

**Attendees:**

- Asad
- Viransh
- Jayesh
- Abdul-Hadi
- Eduardo
- Ankush

**Agenda:**

- Check final PoC PR by Ankush.
- Record skit and demo video for November 21, 2025 presentation.
- Edit the video and submit by today.

---

# January 8th, 2026

Members: Ankush, Asad, Michael, Viransh

Brief meeting to plan moving forward and discuss details of how to implement things

Payment/Owed Details
Expense creator is the only one who can tick off/track payments
Creator would click the expense to go to the confirmation-split page

- They can then click into each person to set the amount payed
  - Clicking should create a popup with an option to add a specific number
  - or mark as fully paid
  - This would be reflected in the confirmation-split page with a X/total number

Authed payment tracking

- Users can send the Expense creator a reminder that they paid (Implement Later)

Groups/Events details
Groups have names
Groups are a selection of people/users
Groups have multiple Events
Groups have a basic chat

- user can send message, it is displayed
  Events have multiple Expenses
  Events can have a day (or days)
- Each date can have a time range/be all day

Discussed features to be implemented

- TAX
  - User sets default tax rate in preferences somehow
  - Item creation screen assumes default tax (shows base price + taxed price + tax amount)
  - User can manually change tax if item has custom tax rate
- TIP

  - Button at end of item creation screen somewhere
  - Opens popup to pick flat tip amount or percentage
    - User can input tip
    - Users can then split the tip similar to an item in the splitting screen

- Groups (Events)

  - Page structure
    - groups page (from bottom nav bar)
      - method to create new group
      - display user's groups
  - by creation date - each group should display: - name - display user profiles (like expense card)

    - Each group page (after clicking group card)

      - Shows name
        - Shows list of users (Like whatsapp list of users)
          - Separate screen opened through clicking on the group name
        - Button to invite people (creator only)
          - Button to remove people (creator only)
          - Button to leave group
      - Shows Events (somehow)
      - Shows chat (somehow)
      - Events/chat design details to be determined by the designer
        They will design the general placement/details and then run it by everyone else in a design review meeting
        details will be discussed there

    - Each event page (after clicking on an event)

      - Shows name
      - Displays days/times (somehow)
      - Displays users of the event (subset of the group + pseudousers)
        - There should be some way to add/remove group members
        - Additionally pseudousers can be added here as well
      - Displays expenses of the event
        - There should be some way of adding/removing expenses (removing should have a confirm)

    - Event expenses
      Adding people to expenses needs to be changed
      Adding a person should bring up a list of people from the Event
      and an one option to add a pseudo person which will take a name

- Backend
  - Auth
    - Firebase auth
    - Each user should store bills (currently)

Tasks to be delegated:

- Firebase/Auth work
  - Ankush/Michael to start working on it 08-01-2026
- Groups design
  - Asad starts designing (to be reviewed -> figma starts)
- Events design
  - Viransh starts designing (to be reviewed -> figma starts)
- Tax & Tip
  - Ankush/Michael to start designing (to be reviewed -> figma starts)

Assistance to be granted by other members as needed so far

Meeting to be held with everyone for design doc/v&v ASAP
