const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';
const SHEET_NAME = 'jokes';
const ADMIN_PIN = '1234'; 

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(SPREADSHEET_ID);
  return ss.getSheetByName(SHEET_NAME);
}

function doPost(e) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  
  try {
    const action = e.parameter.action;
    
    if (action === 'add') {
      return handleAdd(e, output);
    } else if (action === 'rate') {
      return handleRate(e, output);
    } else if (action === 'hide') {
      return handleHide(e, output);
    } else {
      return output.setContent(JSON.stringify({ success: false, message: 'Invalid action' }));
    }
  } catch (error) {
    return output.setContent(JSON.stringify({ success: false, message: error.toString() }));
  }
}

function handleAdd(e, output) {
  const sheet = getSheet();
  const q = e.parameter.question;
  const a = e.parameter.answer;
  const category = e.parameter.category || '기타';
  const tags = e.parameter.tags || '';
  const quality = parseInt(e.parameter.qualityScore) || 50;
  
  if (!q || !a) {
    return output.setContent(JSON.stringify({ success: false, message: 'Question and answer are required' }));
  }

  const newId = 'joke-' + Utilities.getUuid().substring(0, 8);
  const now = new Date().toISOString();
  // Columns: id, question, answer, createdAt, ratingSum, ratingCount, hidden, tags, category, qualityScore, source
  
  sheet.appendRow([
    newId,
    q,
    a,
    now,
    0, // ratingSum
    0, // ratingCount
    "FALSE", // hidden
    tags,
    category,
    quality,
    "USER"
  ]);

  return output.setContent(JSON.stringify({ success: true, message: 'Added successfully', id: newId }));
}

function handleRate(e, output) {
  const sheet = getSheet();
  const id = e.parameter.id;
  const stars = parseFloat(e.parameter.stars);
  
  if (!id || isNaN(stars) || stars < 1 || stars > 5) {
    return output.setContent(JSON.stringify({ success: false, message: 'Invalid rating parameters' }));
  }
  
  const data = sheet.getDataRange().getValues();
  // find row by id (col 0)
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      const currentSum = parseFloat(data[i][4]) || 0;
      const currentCount = parseInt(data[i][5]) || 0;
      
      const rowNum = i + 1;
      sheet.getRange(rowNum, 5).setValue(currentSum + stars);
      sheet.getRange(rowNum, 6).setValue(currentCount + 1);
      
      return output.setContent(JSON.stringify({ success: true, message: 'Rating updated' }));
    }
  }
  
  return output.setContent(JSON.stringify({ success: false, message: 'Joke ID not found' }));
}

function handleHide(e, output) {
  const sheet = getSheet();
  const id = e.parameter.id;
  const pin = e.parameter.pin;
  
  if (pin !== ADMIN_PIN) {
    return output.setContent(JSON.stringify({ success: false, message: 'Unauthorized: Invalid PIN' }));
  }
  
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      const rowNum = i + 1;
      sheet.getRange(rowNum, 7).setValue("TRUE");
      return output.setContent(JSON.stringify({ success: true, message: 'Joke hidden successfully' }));
    }
  }
  
  return output.setContent(JSON.stringify({ success: false, message: 'Joke ID not found' }));
}
