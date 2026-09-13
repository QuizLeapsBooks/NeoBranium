1. update `index.html`: replace `<a href="IQ/top-question.html" class="btn btn-secondary">TopQs</a>` with `<a href="Notes/detailed-notes.html" class="btn btn-secondary">Detailed Notes</a>`. Wait, the previous script replaced it with `TopQs`, I already ran `sed` to fix it!
2. Create `Notes/detailed-notes.html`. It will have tabs for Class 9, 10, 11, 12.
   Under each tab, it has cards for Subjects (Math, Science, English, etc.).
   The user said "hr cards pr chapetr name and number likha ho". I will write "Subject Name" on the card. "kisi bhi buttons pr coming soon likha ho except class 10 science wale pr".
   So for Class 10 -> Science card, the button will say "Read Notes" and link to `class-wise-notes.html`. For all other cards, the button will say "Coming Soon" and link to `#`.
