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
            paid: 20.0,
          },
        },
        {
          id: 'p_sara',
          doc: {
            name: 'Sara',
            color: 'blue',
            userRef: null,
            subtotal: 22.04,
            paid: 10.0,
          },
        },
        {
          id: 'p_ryan',
          doc: {
            name: 'Ryan',
            color: 'green',
            userRef: null,
            subtotal: 22.04,
            paid: 0,
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
            paid: 70.0,
          },
        },
        {
          id: 'p_jane',
          doc: {
            name: 'Jane',
            color: 'red',
            userRef: null,
            subtotal: 60.0,
            paid: 30.0,
          },
        },
        {
          id: 'p_omar',
          doc: {
            name: 'Omar',
            color: 'blue',
            userRef: null,
            subtotal: 60.05,
            paid: 0,
          },
        },
        {
          id: 'p_lee',
          doc: {
            name: 'Lee',
            color: 'green',
            userRef: null,
            subtotal: 60.05,
            paid: 49.71,
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
        groupId: 'group_friends',
        location: 'Place Name',
        locationUrl: 'https://maps.google.com/?q=Place+Name',
        details:
          'Join us for a birthday celebration with cake, games, and great company!',
        createdBy: 'user_ankush',
        participants: ['user_ankush', 'user_michael', 'user_sarah'],
      },
    },
  ],
};
