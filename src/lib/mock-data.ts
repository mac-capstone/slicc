export const mockData = {
  users: [
    {
      id: 'user_ankush',
      doc: {
        displayName: 'Ankush Sarkar',
        email: 'ankush@example.com',
        photoURL: null,
      },
    },
    {
      id: 'user_michael',
      doc: {
        displayName: 'Michael Jordan',
        email: 'michael@example.com',
        photoURL: null,
      },
    },
    {
      id: 'user_sarah',
      doc: {
        displayName: 'Sarah Avery',
        email: 'sarah@example.com',
        photoURL: null,
      },
    },
    {
      id: 'user_jane',
      doc: {
        displayName: 'Jane Doe',
        email: 'jane@example.com',
        photoURL: null,
      },
    },
    {
      id: 'user_omar',
      doc: {
        displayName: 'Omar Lee',
        email: 'omar@example.com',
        photoURL: null,
      },
    },
    {
      id: 'user_ryan',
      doc: {
        displayName: 'Ryan Chen',
        email: 'ryan@example.com',
        photoURL: null,
      },
    },
    {
      id: 'user_emma',
      doc: {
        displayName: 'Emma Wilson',
        email: 'emma@example.com',
        photoURL: null,
      },
    },
    {
      id: 'user_alex',
      doc: {
        displayName: 'Alex Brown',
        email: 'alex@example.com',
        photoURL: null,
      },
    },
  ],

  expenses: [
    {
      id: 'exp_boston_pizza',
      doc: {
        name: 'Boston Pizza',
        date: '2025-10-20',
        createdBy: 'user_ankush',
        totalAmount: 64.23,
        remainingAmount: 23.45,
        participantCount: 3,
      },
      people: [
        {
          id: 'p_michael',
          doc: {
            name: 'Michael',
            color: 'red',
            userRef: null,
            subtotal: 20.15,
          },
        },
        {
          id: 'p_sara',
          doc: {
            name: 'Sara',
            color: 'blue',
            userRef: null,
            subtotal: 22.04,
          },
        },
        {
          id: 'p_ryan',
          doc: {
            name: 'Ryan',
            color: 'green',
            userRef: null,
            subtotal: 22.04,
          },
        },
      ],
      items: [
        {
          id: 'i_pizza',
          doc: {
            name: 'Pepperoni Pizza',
            amount: 30.0,
            split: {
              mode: 'equal',
              shares: {
                p_michael: 10.0,
                p_sara: 10.0,
                p_ryan: 10.0,
              },
            },
            assignedPersonIds: ['p_michael', 'p_sara', 'p_ryan'],
          },
        },
        {
          id: 'i_cactus_cuts',
          doc: {
            name: 'Cactus Cuts',
            amount: 13.5,
            split: {
              mode: 'custom',
              shares: {
                p_michael: 4.5,
                p_sara: 4.5,
              },
            },
            assignedPersonIds: ['p_michael', 'p_sara'],
          },
        },
        {
          id: 'i_drinks',
          doc: {
            name: 'Drinks',
            amount: 20.73,
            split: {
              mode: 'custom',
              shares: {
                p_michael: 5.65,
                p_sara: 7.54,
                p_ryan: 7.54,
              },
            },
            assignedPersonIds: ['p_michael', 'p_sara', 'p_ryan'],
          },
        },
      ],
    },

    {
      id: 'exp_hai_di_lao',
      doc: {
        name: 'Hai Di Lao',
        date: '2025-10-30',
        createdBy: 'user_ankush',
        totalAmount: 250.1,
        remainingAmount: 100.39,
        participantCount: 4,
      },
      people: [
        {
          id: 'p_ankush',
          doc: {
            name: 'Ankush',
            color: 'yellow',
            userRef: 'user_ankush',
            subtotal: 70.0,
          },
        },
        {
          id: 'p_jane',
          doc: {
            name: 'Jane',
            color: 'red',
            userRef: null,
            subtotal: 60.0,
          },
        },
        {
          id: 'p_omar',
          doc: {
            name: 'Omar',
            color: 'blue',
            userRef: null,
            subtotal: 60.05,
          },
        },
        {
          id: 'p_lee',
          doc: {
            name: 'Lee',
            color: 'green',
            userRef: null,
            subtotal: 60.05,
          },
        },
      ],
      items: [
        {
          id: 'i_broth',
          doc: {
            name: 'Tomato & Mushroom Broth',
            amount: 25.0,
            split: {
              mode: 'equal',
              shares: {
                p_ankush: 6.25,
                p_jane: 6.25,
                p_omar: 6.25,
                p_lee: 6.25,
              },
            },
            assignedPersonIds: ['p_ankush', 'p_jane', 'p_omar', 'p_lee'],
          },
        },
        {
          id: 'i_meats',
          doc: {
            name: 'Assorted Meats',
            amount: 95.1,
            split: {
              mode: 'custom',
              shares: {
                p_ankush: 25.1,
                p_jane: 25.0,
                p_omar: 22.5,
                p_lee: 22.5,
              },
            },
            assignedPersonIds: ['p_ankush', 'p_jane', 'p_omar', 'p_lee'],
          },
        },
        {
          id: 'i_veggies',
          doc: {
            name: 'Vegetables',
            amount: 40.0,
            split: {
              mode: 'equal',
              shares: {
                p_ankush: 10.0,
                p_jane: 10.0,
                p_omar: 10.0,
                p_lee: 10.0,
              },
            },
            assignedPersonIds: ['p_ankush', 'p_jane', 'p_omar', 'p_lee'],
          },
        },
        {
          id: 'i_noodles',
          doc: {
            name: 'Dancing Noodles',
            amount: 80.0,
            split: {
              mode: 'custom',
              shares: {
                p_ankush: 28.0,
                p_jane: 22.0,
                p_omar: 30.0,
              },
            },
            assignedPersonIds: ['p_ankush', 'p_jane', 'p_omar'],
          },
        },
      ],
    },
  ],

  events: [
    {
      id: 'event_birthday',
      doc: {
        name: 'Twink Birthday',
        startDate: '2026-02-15',
        endDate: '2026-02-16',
        startTime: '18:00',
        endTime: '22:00',
        isRecurring: true,
        recurringInterval: 1,
        recurringUnit: 'day' as const,
        recurringEndDate: '2026-02-20',
        groupId: 'group_tea_party',
        location: 'Place Name',
        locationUrl: 'https://maps.google.com/?q=Place+Name',
        details:
          'Join us for a birthday celebration with cake, games, and great company!',
        createdBy: 'user_ankush',
        participants: [
          'user_ankush',
          'user_michael',
          'user_sarah',
          'user_jane',
          'user_omar',
          'user_ryan',
          'user_emma',
          'user_alex',
        ],
      },
    },
    {
      id: 'event_capstone',
      doc: {
        name: 'Capstone Meeting',
        startDate: '2026-03-06',
        endDate: '2026-03-06',
        startTime: '14:00',
        endTime: '16:00',
        isRecurring: false,
        groupId: 'group_capstone',
        location: 'Campus',
        createdBy: 'user_ankush',
        participants: [
          'user_ankush',
          'user_michael',
          'user_sarah',
          'user_jane',
          'user_omar',
        ],
      },
    },
  ],

  groups: [
    {
      id: 'group_tea_party',
      doc: {
        title: 'Tea Party',
        eventIds: ['event_birthday'],
        memberIds: [
          'user_ankush',
          'user_michael',
          'user_sarah',
          'user_jane',
          'user_omar',
          'user_ryan',
          'user_emma',
          'user_alex',
        ],
        createdAt: '2026-03-04',
        isPinned: true,
        hasUnreadIndicator: false,
      },
    },
    {
      id: 'group_capstone',
      doc: {
        title: 'Capstone Group',
        eventIds: ['event_capstone'],
        memberIds: [
          'user_ankush',
          'user_michael',
          'user_sarah',
          'user_jane',
          'user_omar',
        ],
        createdAt: '2021-09-04',
        isPinned: true,
        hasUnreadIndicator: true,
      },
    },
    {
      id: 'group_tea_party_2',
      doc: {
        title: 'Tea Party',
        eventIds: ['event_birthday'],
        memberIds: [
          'user_ankush',
          'user_michael',
          'user_sarah',
          'user_jane',
          'user_omar',
          'user_ryan',
          'user_emma',
          'user_alex',
        ],
        createdAt: '2026-03-04',
        isPinned: false,
        hasUnreadIndicator: false,
      },
    },
    {
      id: 'group_capstone_2',
      doc: {
        title: 'Capstone Group',
        eventIds: ['event_capstone'],
        memberIds: [
          'user_ankush',
          'user_michael',
          'user_sarah',
          'user_jane',
          'user_omar',
        ],
        createdAt: '2021-09-04',
        isPinned: true,
        hasUnreadIndicator: true,
      },
    },
  ],
};
