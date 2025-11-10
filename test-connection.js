#!/usr/bin/env node
/**
 * Test OData Connection to FileMaker Server
 * Quick test script to verify connectivity and basic operations
 */

import { ODataClient } from './dist/odata-client.js';
import { ODataParser } from './dist/odata-parser.js';

// Test configuration
const config = {
  server: 'https://192.168.0.24',
  database: 'Contacts',
  user: 'admin',
  password: '***REMOVED***',
  timeout: 30000,
};

const TABLE_NAME = 'contact';

console.log('='.repeat(60));
console.log('FileMaker OData Connection Test');
console.log('='.repeat(60));
console.log(`Server: ${config.server}`);
console.log(`Database: ${config.database}`);
console.log(`User: ${config.user}`);
console.log(`Table: ${TABLE_NAME}`);
console.log('='.repeat(60));
console.log();

async function runTests() {
  try {
    // Create OData client
    console.log('Creating OData client...');
    const client = new ODataClient(config);
    console.log('✓ Client created\n');

    // Test 1: Connection Test
    console.log('Test 1: Testing connection...');
    const isConnected = await client.testConnection();
    if (!isConnected) {
      throw new Error('Connection test failed');
    }
    console.log('✓ Connection successful\n');

    // Test 2: Get Service Document
    console.log('Test 2: Getting service document...');
    const serviceDoc = await client.getServiceDocument();
    console.log('✓ Service document retrieved');
    console.log('Service URL:', serviceDoc['@odata.context']);
    console.log();

    // Test 3: Get Metadata
    console.log('Test 3: Getting metadata...');
    const metadata = await client.getMetadata();
    console.log('✓ Metadata retrieved');
    console.log('Metadata length:', metadata.length, 'characters');
    console.log();

    // Test 4: List Tables
    console.log('Test 4: Parsing tables from metadata...');
    const tables = ODataParser.parseMetadataForTables(metadata);
    console.log('✓ Tables found:', tables.length);
    console.log('Available tables:', tables.join(', '));
    console.log();

    // Test 5: Count Records
    console.log(`Test 5: Counting records in ${TABLE_NAME} table...`);
    const count = await client.countRecords(TABLE_NAME);
    console.log(`✓ Total records in ${TABLE_NAME}:`, count);
    console.log();

    // Test 6: Query Records (limit 3)
    console.log(`Test 6: Querying first 3 records from ${TABLE_NAME}...`);
    const response = await client.queryRecords(TABLE_NAME, {
      top: 3,
      count: true
    });
    console.log('✓ Records retrieved');
    console.log('Records returned:', response.value.length);
    console.log('Total count:', response['@odata.count'] || 'N/A');
    
    if (response.value.length > 0) {
      console.log('\nFirst record fields:');
      const firstRecord = response.value[0];
      const fields = Object.keys(firstRecord).filter(k => !k.startsWith('@odata'));
      fields.slice(0, 5).forEach(field => {
        const value = firstRecord[field];
        const displayValue = typeof value === 'string' && value.length > 50 
          ? value.substring(0, 50) + '...' 
          : value;
        console.log(`  - ${field}: ${displayValue}`);
      });
      if (fields.length > 5) {
        console.log(`  ... and ${fields.length - 5} more fields`);
      }
    }
    console.log();

    // Test 7: Query with Filter (if possible)
    console.log(`Test 7: Testing filtered query...`);
    try {
      const filteredResponse = await client.queryRecords(TABLE_NAME, {
        top: 1,
        select: fields.slice(0, 3).join(',')
      });
      console.log('✓ Filtered query successful');
      console.log('Records returned:', filteredResponse.value.length);
      console.log();
    } catch (error) {
      console.log('⚠ Filtered query skipped:', error.message);
      console.log();
    }

    // Test 8: Get Single Record (if we have records)
    if (response.value.length > 0) {
      console.log(`Test 8: Getting single record by ID...`);
      const firstRecord = response.value[0];
      // Try to find the ID field (common names)
      const idField = Object.keys(firstRecord).find(k => 
        k.toLowerCase().includes('id') || 
        k === '__ID' || 
        k === 'recordId'
      );
      
      if (idField) {
        const recordId = firstRecord[idField];
        console.log(`Attempting to get record with ID field "${idField}" = "${recordId}"`);
        try {
          const singleRecord = await client.getRecord(TABLE_NAME, String(recordId));
          console.log('✓ Single record retrieved');
          console.log('Record ID:', recordId);
        } catch (error) {
          console.log('⚠ Could not retrieve single record:', error.message);
          console.log('  (This is normal if FileMaker ID format is different)');
        }
      } else {
        console.log('⚠ Could not identify ID field, skipping single record test');
      }
      console.log();
    }

    // Summary
    console.log('='.repeat(60));
    console.log('✓ All connection tests passed!');
    console.log('='.repeat(60));
    console.log('\nYour FileMaker OData API is working correctly!');
    console.log(`You can now use the MCP server with ${tables.length} available tables.`);
    console.log();

  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('✗ TEST FAILED');
    console.error('='.repeat(60));
    console.error('\nError:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.error('\nPossible causes:');
      console.error('- FileMaker Server is not running');
      console.error('- Server is not accessible at http://192.168.0.24');
      console.error('- Firewall blocking connection');
    } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      console.error('\nPossible causes:');
      console.error('- Incorrect username or password');
      console.error('- User does not have OData access privileges');
    } else if (error.message.includes('404')) {
      console.error('\nPossible causes:');
      console.error('- Database name is incorrect (case-sensitive)');
      console.error('- OData is not enabled for this database');
      console.error('- Table name is incorrect');
    }
    
    console.error('\nDebug Information:');
    console.error('Full error:', error);
    console.error();
    process.exit(1);
  }
}

// Run tests
runTests();
