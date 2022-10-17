/**
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const fs = require('fs');
const DataGathererFramework = require('../build/appscript-bundle');
const { initFakeSheet, fakeSheetData, SpreadsheetApp, Session, Utilities,
  ScriptApp, Logger, Browser, UrlFetchApp } = require('../test/connectors/appscript-test-utils');

let core = null;
let fakeSheets = {};

global.SpreadsheetApp = SpreadsheetApp;
global.SpreadsheetApp.getActive = () => ({
  getSheetByName: (tabName) => {
    if (!fakeSheets[tabName]) {
      throw new Error(`${tabName} not initialized with initFakeSheet yet.`);
    }
    return fakeSheets[tabName];
  },
  getId: () => 'sheet-1234',
});
global.Session = Session;
global.Utilities = Utilities;
global.ScriptApp = ScriptApp;
global.Logger = Logger;
global.Browser = Browser;
global.UrlFetchApp = UrlFetchApp;

describe('DataGathererFramework bundle for AppScript', () => {
  beforeEach(() => {
    fakeSheets = {
      'Settings': initFakeSheet(fakeSheetData.fakeEnvVarsSheetData),
      'System': initFakeSheet(fakeSheetData.fakeSystemSheetData),
      'Locations': initFakeSheet(fakeSheetData.fakeLocationsSheetData),
      'Sources-1': initFakeSheet(fakeSheetData.fakeSourcesSheetData),
      'Results-1': initFakeSheet(fakeSheetData.fakeEmptyResultsSheetData),
      'Sources-2': initFakeSheet(fakeSheetData.fakeSourcesSheetData),
      'Results-2': initFakeSheet(fakeSheetData.fakeEmptyResultsSheetData),
    };

    let coreConfig = {
      helper: 'appscript',
      extensions: [
        'appscript',
      ],
      // specific configs below
      appscript: {
        envVarsTabId: 'Settings',
        systemTabId: 'System',
        tabs: {
          'Sources-1': {
            dataAxis: 'row',
            propertyLookupRow: 2, // Starts at 1
            skipColumns: 0,
            skipRows: 3,
          },
          'Sources-2': {
            dataAxis: 'row',
            propertyLookupRow: 2, // Starts at 1
            skipColumns: 0,
            skipRows: 3,
          },
          'Results-1': {
            dataAxis: 'row',
            propertyLookupRow: 2, // Starts at 1
            skipColumns: 0,
            skipRows: 3,
          },
          'Results-2': {
            dataAxis: 'row',
            propertyLookupRow: 2, // Starts at 1
            skipColumns: 0,
            skipRows: 3,
          },
          'Settings': {
            dataAxis: 'column',
            propertyLookupRow: 2, // Starts at 1
            skipColumns: 2,
            skipRows: 1,
          },
          'System': {
            dataAxis: 'column',
            propertyLookupRow: 2, // Starts at 1
            skipColumns: 2,
            skipRows: 1,
          },
        },
      },
      batchUpdateBuffer: 10,
      verbose: false,
      debug: false,
      quiet: true,
    };

    core = new DataGathererFramework(coreConfig);
  });

  it('creates DataGathererFramework instance', () => {
    expect(core).not.toBe(null);
  });

  it('initializes DataGathererFramework for AppScript via connector init', () => {
    core.connector.apiHandler.fetch = () => {
      return {
        statusCode: 200,
        body: JSON.stringify({
          'data': {}
        })
      }
    };

    core.connector.init();

    // Ensure it creates triggers for 'submitRecurringSources' and 'onEditFunc'.
    let systemData = fakeSheets['System'].fakeData;

    // Ensure it updates the last init timestamp.
    expect(systemData[4][2]).not.toBe('');
    expect(systemData[4][2]).toBeGreaterThan(0);
  });

  it('submits selected source rows and writes results to specific tabs', async () => {
    let resultsData1 = fakeSheets['Results-1'].fakeData;
    let resultsData2 = fakeSheets['Results-2'].fakeData;
    expect(resultsData1.length).toEqual(3);
    expect(resultsData2.length).toEqual(3);

    let systemData = [
      ['Name', 'key', 'value'],
      ['Retrieve Trigger ID', 'RETRIEVE_TRIGGER_ID', ''],
    ];
    fakeSheets['System'] = initFakeSheet(systemData);

    // Running sources and writing to Results-2 tab.
    await core.run({
      srcDatasetId: 'Sources-1',
      destDatasetId: 'Results-2', // Results-2 tab.
      filters: ['selected'],
    });
    // Ensure there's no additional rows written to Results-1 tab.
    expect(resultsData1.length).toEqual(3);

    // Ensure two additional rows written to Results-2 tab.
    expect(resultsData2.length).toEqual(5);

    // Running sources and writing to Results-1 tab.
    await core.run({
      srcDatasetId: 'Sources-1',
      destDatasetId: 'Results-1',
      filters: ['selected'],
    });
    // Ensure there are two additional rows in the Results tab.
    expect(resultsData1.length).toEqual(5);

    // Ensure there's no additional rows written to Results-2 tab.
    expect(resultsData2.length).toEqual(5);

    // Verify each result row's status and URL.
    expect(resultsData1[3][3]).toEqual('Retrieved');
    expect(resultsData1[3][4]).toEqual('google.com');
    expect(resultsData1[4][3]).toEqual('Retrieved');
    expect(resultsData1[4][4]).toEqual('web.dev');
  });
});
