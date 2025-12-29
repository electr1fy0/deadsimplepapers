export function renderDialog(): void {
    const uploadDialog: HTMLElement | null =
        document.getElementById("upload-dialog");

    uploadDialog.innerHTML = `
    <span class="upload-guide">
        Contribute a paper and help the community. PDFs and Images are accepted.<br />
        Your uploads will be analyzed before being shown here.
    </span>

    <form id="upload-form">
        <div class="form-row">
            <div class="form-group" style="flex: 2">
                <label for="course-name">Course Title</label>
                <input type="text" id="course-name" name="course_title" placeholder="e.g. Database Systems"
                    required />
            </div>
            <div class="form-group" style="flex: 1">
                <label for="course-code">Code</label>
                <input type="text" id="course-code" name="course_code" placeholder="e.g BCSE302L" />
            </div>
        </div>

        <div class="form-row">
            <div class="form-group">
                <label for="year">Year</label>
                <select id="year" name="year">
                    <option value="" selected>Select Year</option>
                    <option value="2026">2026</option>
                    <option value="2025">2025</option>
                    <option value="2024">2024</option>
                    <option value="2023">2023</option>
                    <option value="2022">2022</option>
                    <option value="2021">2021</option>
                </select>
            </div>


            <div class="form-group">
                <label for="semester_name">Semester</label>
                <select id="semester_name" name="semester_name">
                    <option value="" selected>Select Semester</option>
                    <option value="Fallsem">Fall</option>
                    <option value="Wintersem">Winter</option>
                    <option value="Summersem">Summer</option>
                </select>
            </div>
        </div>

        <div class="form-row">
            <div class="form-group">
                <label for="exam-type">Exam</label>
                <select id="exam-type" name="exam_type">
                    <option value="" selected>Select Exam</option>
                    <option value="cat1">CAT 1</option>
                    <option value="cat2">CAT 2</option>
                    <option value="fat">FAT</option>
                </select>
            </div>
            <div class="form-group">
                <label for="slot">Slot</label>
                <input type="text" id="slot" name="slot" placeholder="e.g. A1" />
            </div>
        </div>

        <input type="file" id="file" name="file" hidden required />
        <label for="file" class="file-trigger">Select a file</label>
        <span class="fileName"></span>

        <menu>
            <button type="button" class="cancel-btn">Cancel</button>
            <button class="confirm-btn">Upload</button>
        </menu>
    </form>`;
}
