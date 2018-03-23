'use babel';

import ParseObject from './ParseObject';

const UPDATE_FREQ = {
    'High': 0,
    'Medium': 500,
    'Low': 2000,
    'On Save Only': -1
};

// DocTree: represents the document tree and all related actions relating to the abstract tree
export default class DocTree {
    constructor(updateFreqText) {
        this.setUpdateFreq(updateFreqText);
        this.docTree = [];
        this.timeout = null;
    }

    // Change update frequency
    setUpdateFreq(updateFreqText) {
        this.updateFreq = UPDATE_FREQ[updateFreqText];
    }

    // Update document tree of current editor
    updateDocTree(editor) {

        // Resets docTree
        this.docTree = [];

        // Add to docTree
        let buffNow = editor.getBuffer();
        this.appendToDocTree (buffNow, null);

    }

    // Add to current docTree using the textBuffer provided
    // Can be recursively called (need to make sure not calling the same
    // buffer / infinite recursive loop)
    appendToDocTree (buff, prevLvl) {
        let regEx = new RegExp(/\\(include|input|part|chapter|(?:sub){0,2}section|(?:sub)?paragraph)(?:\s*(?:%.*\s*)*\*?\s*(?:%.*\s*)*{|\s*(?:%.*\s*)*\[)/, 'gm');

        // Scan text buffer for regex
        buff.scan(regEx, result => {
            let parseObj = new ParseObject(result, buff);

            // It may be a false match (eg. commented / incorrect syntax)
            if (parseObj.parse() === null)
                return;

            // Check if it is '\include' or '\input'
            if (parseObj.level < 0) {
                let targetBuff = parseObj.getTargetFileBuff();
                if (targetBuff === null)
                    return;

                // Store previous file information (handle start pt and path)
                this.appendToDocTree(targetBuff,
                    {
                        handleStartPt: result.range.start,
                        filePath: buff.getPath()
                    }
                );
            }
            else {
                // Normal header (not '\include' or '\input')
                this.docTree.push(parseObj.createDocNode(prevLvl));
            }
        });

    }

    // Called whenever tab stops changing or when document is saved
    updateTreeView(editor, updateImmediately, treeView) {
        if (updateImmediately || this.updateFreq <= 0) {
            this.updateDocTree(editor);
            treeView.updateTree(this.docTree, editor);
        }
        else {
            if (this.timeout != null) {
                clearTimeout(this.timeout);
            }
            this.timeout = setTimeout(() => {
                this.updateDocTree(editor);
                treeView.updateTree(this.docTree, editor);
            }, this.updateFreq);
        }
    }

}
