export const en = {
    buttons: {
        serviceStatus: '📡 Service Status',
        myFeedbacks: '📋 My Feedbacks',
        createFeedback: '➕ New Feedback',
        help: 'ℹ️ Help',
        cancel: '❌ Cancel',
        sharePhone: '📞 Share Phone Number',
        backToHome: '⬅️ Back to Home',
        back: '⬅️ Back',
        refresh: '🔄 Refresh'
    },
    statusLabels: {
        0: '🟢 Open',
        1: '🟡 In Progress',
        2: '🟠 Waiting for Response',
        3: '🔵 Closed',
        4: '🔴 Rejected'
    } as Record<number, string>,
    messages: {
        registration: (name: string) => [
            `👋 Hello, ${name}!`,
            '',
            'You need to register before sending feedback.',
            'Tap the button below and share your phone number.'
        ].join('\n'),
        registrationOwnPhoneOnly: '❗ Please share your own phone number.',
        registrationUseButton: '❗ Please use the button below to share your contact.',
        registrationSuccess: '✅ Registration completed.',
        alreadyRegistered: '✅ You are already registered.',
        registrationFailed: '❌ Registration failed. Please try again later.',
        home: (name: string, prefix?: string) => [
            prefix,
            `👋 ${name}!`,
            '',
            'What would you like to do?',
            '',
            '• Create a new feedback',
            '• View your recent feedbacks',
            '• Check service availability',
            '• Open help'
        ].filter(Boolean).join('\n'),
        help: [
            'ℹ️ How the bot works',
            '',
            '1. Register once with your phone number.',
            '2. Open "New Feedback".',
            '3. Send the issue description as a normal message.',
            '4. Check statuses in "My Feedbacks".',
            '',
            'Use /start at any time to return to the home screen.'
        ].join('\n'),
        feedbackComposer: [
            '📝 Describe the issue in a single message.',
            '',
            'Useful details:',
            '• what happened',
            '• when it happened',
            '• what result you expected',
            '',
            'After that, the bot will send your feedback to the support system.'
        ].join('\n'),
        feedbackSent: [
            '✅ Feedback sent.',
            '',
            'You can now create another feedback or open the recent list.'
        ].join('\n'),
        feedbackCancelled: '↩️ Feedback creation cancelled.',
        feedbackSaveFailed: '❌ Failed to save feedback. Please try again.',
        noFeedbacks: [
            '📋 My Feedbacks',
            '',
            'You do not have any feedbacks yet.'
        ].join('\n'),
        feedbacksTitle: '📋 My Feedbacks',
        feedbackLoadFailed: '❌ Failed to load feedbacks. Please try again later.',
        serviceOnline: [
            '📡 Service Status',
            '',
            '✅ API is available.',
            'You can send new feedback right now.'
        ].join('\n'),
        serviceOffline: [
            '📡 Service Status',
            '',
            '⚠️ API is temporarily unavailable.',
            'Please try again a bit later.'
        ].join('\n'),
        unknownInput: [
            'Use the buttons below to navigate.',
            'Free text is only used when creating new feedback.'
        ].join('\n'),
        connectionError: '⚠️ Connection error. Please try again later.',
        updateNotification: (text: string) => `🤖 Bot updated!\n\n${text}`,
        helpCommand: 'Use /start to open the main menu.',
        unknownDate: 'Unknown date'
    }
};
