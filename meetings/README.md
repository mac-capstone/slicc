# COMPSCI 4ZP6A Meeting Notes

## Table of Contents

- [September 3, 2025 - First Meeting](#september-3-2025---first-meeting)
- [September 15, 2025 - Second Meeting](#september-15-2025---second-meeting)
- [September 19, 2025 - Third Meeting](#september-19-2025---third-meeting)
- [October 4, 2025 - Fourth Meeting](#october-4-2025---fourth-meeting)
- [October 10, 2025 - Fifth Meeting](#october-10-2025---fifth-meeting)
- [October 23, 2025 - Sixth Meeting](#october-23-2025---sixth-meeting)
- [October 30, 2025 - Seventh Meeting](#october-30-2025---seventh-meeting)
- [November 4, 2025 - Eighth Meeting](#november-4-2025---eighth-meeting)
- [November 6, 2025 - Ninth Meeting](#november-6-2025---ninth-meeting)
- [November 13, 2025 - Tenth Meeting](#november-13-2025---tenth-meeting)
- [November 19, 2025 - Eleventh Meeting](#november-19-2025---eleventh-meeting)
- [November 20, 2025 - Twelfth Meeting](#november-20-2025---twelfth-meeting)
- [January 7th, 2026 - Thirteenth Meeting](#january-7th-2026---thirteenth-meeting)
- [January 14th, 2026 - Fourteenth Meeting](#january-14th-2026---fourteenth-meeting)
- [March 4th, 2026 - Fifteenth Meeting](#march-4th-2026---fifteenth-meeting)
- [March 29th, 2026 - Design Review](#march-29th-2026---design-review)

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

## October 23, 2025 - Sixth Meeting

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

## October 30, 2025 - Seventh Meeting

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

## November 4, 2025 - Eighth Meeting

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

## November 6, 2025 - Ninth Meeting

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

## November 13, 2025 - Tenth Meeting

**Attendees:**

- Michael
- Asad
- Viransh
- Jayesh

**Agenda:**

- Review progress on assigned modules according to PoC Figma and Linear tasks.
- Discuss any challenges faced during development.
- Plan next steps and set deadlines for UI module completion.

---

## November 19, 2025 - Eleventh Meeting

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

## November 20, 2025 - Twelfth Meeting

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

## January 7th, 2026 - Thirteenth Meeting

**Attendees:**

- Ankush
- Asad
- Michael
- Viransh

**Brief meeting to plan moving forward and discuss details of how to implement things**

Payment/Owed Details
Expense creator is the only one who can tick off/track payments
Creator would click the expense to go to the confirmation-split page

- They can then click into each person to set the amount payed
  - Clicking should create a popup with an option to add a specific number
  - or mark as fully paid
  - This would be reflected in the confirmation-split page with a X/total number

**Authed payment tracking**

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

**Discussed features to be implemented**

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

**Tasks to be delegated:**

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

---

## January 14th, 2026 - Fourteenth Meeting

**Attendees:**

- Michael
- Asad
- Viransh
- Jayesh
- Abdul-Hadi
- Eduardo
- Ankush

**Topic:** Design doc/V&V

**Agenda:**

Reviewed last meeting with missing members.

**Design review for groups/events:**

- Groups
  - No invitations to groups, just added directly.
- Events
  - Events will have invitations.
  - Invites will show up in the event/notifs tab.
- Designs posted in <#1433529264187248650> channel.

**Design Doc/V&V:**

Design Doc:

Part 4 is mostly done, we will use our existing diagram and modify it to fit our existing design/the requirements of the doc.

- Went over what changes need to be made.
- The updated version will be added to the design doc.

Parts 5-7 will be split and done by the team. Work on the doc will be done according to the SRS formatting.

**MEETING WITH INSTRUCTOR on FRI 16th 10:15AM**

V&V:

Hadi and Eduardo will be working on the V&V.

---

## March 4th, 2026 - Fifteenth Meeting

**Attendees:**

- Michael
- Asad
- Viransh
- Jayesh
- Abdul-Hadi
- Eduardo
- Ankush

**NOTES:**

All PRs should include a WIP/unfinished notes, to be referred back to. PRs without this should not be merged, unfinished features will be forgotten if not tracked.

Now using react native reusable component library. All components should use existing components from this library if possible, then custom will be created.

**Meeting Topics:**

- Review current events/groups work.
- Decide priorities.
- Delegate tasks.
- Decide deadlines.

**TASKS AND DEADLINES:**

**Events - Viransh - SUNDAY 03/08**

- Implement Firebase.
  - Use react query for this.
  - When getting data, use zod to verify format.
- Events title should look like an input box, currently can't tell you can click on it (use RN reusable input component).
- Start and End should be inline and be darkened (follow figma).
- Fix view expenses button to bottom of screen.
- View expenses button should lead unique view expenses page specific to the event.
- Move edit button to be in line with the Title, not back button.
- Exit button should be back (pop from routing stack, not home page).
  - This can be implemented after groups are implemented.
- Events (day/year/month) dropdown is currently toggling instead of dropdown.
- Saving edit event led to Invalid Recurring Start Date (cannot recreate, low prio).

**Groups - Asad & Jayesh - DEADLINE TBD, talk on campus when possible, but try to be ASAP to discuss progress on groups**

- Frontend adjustments.
  - Adjust add button to be more clear (use floating circular + button [bottom middle of screen]).
- Implement frontend -> needs to be reviewed asap to start working on data calls.
- Implement Firebase features.
  - Use react query for this.
  - When getting data, use zod to verify format.

**Michael - FRIDAY 03/06**

- Show/edit how much is paid for expenses (LOOK AT FIGMA / ATTACHED IMAGE).
  - Edit button top right in line with title.
    - Button opens up edit page, with list of people and their owed amounts and remaining.
    - Buttons to mark all as paid and button to open input box for custom amount.
  - Update split page to show paid, remaining.

**Hadi - SUNDAY 03/08**

- Fix NAN bug ASAP (issue has been assigned for a long time).
  - Needs to have money input (floats, nums, etc).
  - Test before PR.
- Expense page.
  - Use RN reusable input component instead.
  - Expense name gets removed when going next page then prev page, fix that.
- Fix bug with expense page subtotal, issue [CAP-61].

**Eduardo - TUES 03/10**

- Adding people to expenses needs to be changed.
  - (Quick figma or sketch NEEDED by FRIDAY 03/06, once figma or sketch call DESIGN REV ASAP PLS TO START CODE).
  - Adding a person should bring up a list of people.
  - List has your friends and one option to add a pseudo person.
    - Pseudo person option opens modal which will take a name.
  - This needs to be an alternate version of the expense page vs the default expense page where you add people.
    - So make a flag to tell what type to render.
    - The only difference is whether adding a person pulls up a list of all friends (default behaviour) or the list containing people from the event (event behaviour).

**Ankush**

- Auth google - SUNDAY 03/08.
- Expenses firebase integration - FRIDAY 03/06.

---

## March 29th, 2026 - Design Review

Chat

- Fix auto-generated key, locked messages should never show.
- Change send message button to fit color theme.
- Add images to chat.
- Change colors to fit current theme.
- Openable dropdown menu for group's current events pinned at top.

Groups

- Change groups to show chat by default.
- Clicking name shows group info, with users + events + admin controls.
  - Events
    - Shows past and upcoming events in info page.
  - Users
    - Button to remove user (admin).
    - Button to delete group (admin).

Expenses

- Need to handle cases for the "manage people" button (too many ppl, non-friends, etc).
- Change manage people to show:
  - No one at first.
  - Search bar.
    - Shows matching users.
    - And default pseudo people.
  - Once a user is added to an item, they show up in the list for other items.
  - Change page to be scrollable to handle too many people.
- Update receipt for tip + tax.

Recommendations

- Change map to be openable instead of nearby.
- Remove view bar.
- Add saved instead of favourites.
- Redesign how locations are shown, based on lovable design.
- Detailed location page.
  - Add saved button top right.
  - Add phone number.
  - Add way to change rating.

Eduardo

- Testing.

Hadi

- Deployment.
