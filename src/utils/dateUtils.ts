export const getMaxDaysForMonth = (month: string, year?: number): number => {
    const monthLower = month?.toLowerCase().trim();

    if (!monthLower || ![
        "january", "february", "march", "april", "may", "june",
        "july", "august", "september", "october", "november", "december"
    ].includes(monthLower)) {
        return 31;
    }

    if (monthLower === "february") {
        if (year) {
            const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
            return isLeapYear ? 29 : 28;
        }
        return 28;
    }

    if (["april", "june", "september", "november"].includes(monthLower)) {
        return 30;
    }

    return 31;
};

export const getDayFilterDescription = (
    baseDescription: string,
    monthValue?: string,
    yearValue?: number
): string => {
    const maxDays = monthValue ? getMaxDaysForMonth(monthValue, yearValue) : 31;
    return baseDescription.replace(/\(1-31\)/, `(1-${maxDays})`);
};

// New function to generate time options
export const getTimeOptions = (): string[] => {
    const options: string[] = [];
    for (let hour = 0; hour < 24; hour++) {
        for (let minute = 0; minute < 60; minute += 15) {
            const period = hour < 12 ? "AM" : "PM";
            const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
            const displayMinute = minute < 10 ? `0${minute}` : minute;
            const time = `${displayHour}:${displayMinute} ${period}`;
            options.push(time);
        }
    }
    return options;
};