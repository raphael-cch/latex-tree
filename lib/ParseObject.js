'use babel';

import { Point, Range } from 'atom'

const LEVELS_FOR_WORDS = {
    'part': 1,
    'chapter': 2,
    'section': 3,
    'subsection': 4,
    'subsubsection': 5,
    'paragraph': 6,
    'subparagraph': 7
}

// ParseObject: encapsulates parsing of text and storing the parsed information
export default class ParseObject {
    constructor(result, buffNow) {
        this.matchStartPt = new Point(result.range.start.row, result.range.start.column);
        this.buffer = buffNow;
        this.pointNow = new Point(result.range.end.row, result.range.end.column);
        // result.match[1] is the captured word in regex, mapping with the
        // LEVELS_FOR_WORDS object gives correct level number
        this.level = LEVELS_FOR_WORDS[result.match[1]];
        this.text = null;
    }

    // Main parsing of the object
    parse () {

        // Check if it is being commented / wrong match
        let lineNow = this.buffer.lineForRow(this.matchStartPt.row);
        for (var i = 0; i < this.matchStartPt.column; i++) {
            if (lineNow[i] === '\\') {
                i++;
                // This is the case for eg ...\\section..., \\ is line break
                // and the word 'section' happens to come after it
                // so it is a wrong match
                if (i === this.matchStartPt.column)
                    return null;
            }
            else if (lineNow[i] === '%') {
                // The line is being commented
                return null;
            }
        }

        // Skip comments
        if (this.skipAllComments() === null)
            return null;

        // Skip short title
        if (this.buffer.lineForRow(this.pointNow.row)[this.pointNow.column-1]
            === '[') {

            // Disregard the short title
            if (this.getText(']') === null)
                return null;

            // Skip all space
            this.skipAllSpaces();

            // Move one more space to align pointNow correctly
            if (this.mvText(1) === null)
                return null;
        }

        // Skip comments
        if (this.skipAllComments() === null)
            return null;

        // Get main title
        if (this.buffer.lineForRow(this.pointNow.row)[this.pointNow.column-1]
            === '{') {
            // Get text of title
            this.text = this.getText('}');

            // If getText returns null, it may be a comment, so return
            if (this.text === null)
                return null;
        }
        else return null;
    }

    // Get the text starting from pointNow, until the matching delimiters
    getText (delimiterToMatch) {

        let textStartPt = new Point(this.pointNow.row, this.pointNow.column);
        let lineNow = this.buffer.lineForRow(textStartPt.row);

        // Check if it is being commented
        // This should be obsolete because parse() now checks for comments
        /*
        for (let i = 0; i <= this.matchStartPt.column; i++) {
            if (lineNow[i] === '\\')
                i++;
            else if (lineNow[i] === '%')
                return null;
        }
        */

        let lineNoNow = this.pointNow.row;
        let noOfUnclosedBrack = {};
        noOfUnclosedBrack['}'] = 0;
        noOfUnclosedBrack[']'] = 0;
        while (1) {

            // Update lineNoNow and lineNow if pointNow has changed
            if (this.pointNow.row != lineNoNow) {
                lineNoNow = this.pointNow.row;
                lineNow = this.buffer.lineForRow(lineNoNow);
            }

            // Parse each character
            let charNow = lineNow[this.pointNow.column];
            if (charNow === delimiterToMatch) {
                if (noOfUnclosedBrack[delimiterToMatch] === 0)
                    break;
                else
                    noOfUnclosedBrack[delimiterToMatch]--;
            }
            else if (charNow === ']' || charNow === '}') {
                // For when matching the other delimiter
                noOfUnclosedBrack[charNow]--;
            }
            else if (charNow === '{') {
                noOfUnclosedBrack['}']++;
            }
            else if (charNow === '[') {
                noOfUnclosedBrack[']']++;
            }
            else if (charNow === '\\') {
                if (this.mvText(1) === null)
                    return null;
            }
            else if (charNow === '%') {
                this.pointNow.column = 0;
                let nextRow = this.buffer.nextNonBlankRow(this.pointNow.row);
                if (nextRow === null)
                    return null;
                else this.pointNow.row = nextRow;
                lineNow = this.buffer.lineForRow(this.pointNow.row);
                continue;
            }
            if (this.mvText(1) === null)
                return null;
        }

        // Get return text based on current position and start position
        let returnTxt = this.buffer.getTextInRange(Range(textStartPt, this.pointNow));

        // no need to return null if this fails because this is just for
        // aligning pointNow for the next call of getText (if any)
        this.mvText(1);

        // Remove all comments
        returnTxt = returnTxt.replace(/([^\\])%.*/g, '$1');

        // Remove all space
        return returnTxt.replace(/\s+/g, ' ');
    }

    // Move pointNow to skip all comments (pointNow is at the
    // SECOND character after all comments)
    skipAllComments() {
        while (this.buffer.lineForRow(this.pointNow.row)[this.pointNow.column-1]
            === '%') {
            let nextRow = this.buffer.nextNonBlankRow(this.pointNow.row);
            if (nextRow === null)
                return null;
            else this.pointNow.row = nextRow;
            this.pointNow.column = 0;

            // Skip all space
            if (this.skipAllSpaces() === null)
                return null;

            // Move one more space to align pointNow correctly
            if (this.mvText(1) === null)
                return null;
        }
    }

    // Move pointNow to skip all spaces (pointNow is at the first character
    // after all spaces)
    skipAllSpaces () {
        while (RegExp(/\s/).test(
            this.buffer.lineForRow(this.pointNow.row)[this.pointNow.column]
        ))
        {
            if (this.mvText(1) === null)
                return null;
        }
    }

    // Move pointNow by noOfChar
    mvText (noOfChar) {
        this.pointNow.column += noOfChar;
        while (this.buffer.lineLengthForRow(this.pointNow.row) <= this.pointNow.column) {
            this.pointNow.column -= this.buffer.lineLengthForRow(this.pointNow.row);
            let nextRow = this.buffer.nextNonBlankRow(this.pointNow.row);
            if (nextRow === null)
                return null;
            else this.pointNow.row = nextRow;
        }
    }

    // Create a docNode in docTree using the current ParseObject
    createDocNode () {
        return {
            text: this.text,
            level: this.level,
            startPt: new Point(this.matchStartPt.row, this.matchStartPt.column)
        };
    }
}
