const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:5000/api/users';
const TEST_PHONE = '+1234567890';
const TEST_PASSWORD = 'testpassword123';

// Test data
const testUser = {
    fullName: 'Test User',
    phone: TEST_PHONE,
    password: TEST_PASSWORD,
    profileImage: 'https://example.com/user.jpg',
    type: 'verification',
    userType: 'user'
};

const testAdvertiser = {
    fullName: 'Test Advertiser',
    phone: '+1234567891',
    password: TEST_PASSWORD,
    storeName: 'Test Store',
    storeImage: 'https://example.com/store.jpg',
    description: 'A test store for testing purposes',
    type: 'verification',
    userType: 'advertiser'
};

// Helper function to log results
const logResult = (step, success, data = null, error = null) => {
    console.log(`\n${step}:`);
    if (success) {
        console.log('✅ SUCCESS');
        if (data) console.log('Data:', JSON.stringify(data, null, 2));
    } else {
        console.log('❌ FAILED');
        if (error) console.log('Error:', error);
    }
    console.log('─'.repeat(50));
};

// Test User Registration Flow
const testUserRegistration = async () => {
    console.log('\n🧪 TESTING USER REGISTRATION FLOW');
    console.log('═'.repeat(50));

    try {
        // Step 1: Send OTP for user verification (with all user data)
        console.log('Step 1: Sending OTP for user verification (with all data)...');
        const otpResponse = await axios.post(`${BASE_URL}/send-otp`, testUser);
        
        if (otpResponse.data.otp) {
            logResult('Send OTP for User', true, { otp: otpResponse.data.otp });
            
            // Step 2: Verify OTP and create account (only OTP + basic info needed)
            console.log('Step 2: Verifying OTP and creating user account...');
            const verifyResponse = await axios.post(`${BASE_URL}/verify-otp`, {
                otp: otpResponse.data.otp,
                phone: testUser.phone,
                type: testUser.type,
                userType: testUser.userType
            });
            
            logResult('Verify OTP and Create User Account', true, {
                id: verifyResponse.data.user.id,
                token: verifyResponse.data.token ? 'JWT_TOKEN_RECEIVED' : 'NO_TOKEN'
            });
            
            return verifyResponse.data.token;
        } else {
            logResult('Send OTP for User', false, null, 'No OTP received in response');
            return null;
        }
    } catch (error) {
        logResult('User Registration Flow', false, null, error.response?.data?.error || error.message);
        return null;
    }
};

// Test Advertiser Registration Flow
const testAdvertiserRegistration = async () => {
    console.log('\n🏪 TESTING ADVERTISER REGISTRATION FLOW');
    console.log('═'.repeat(50));

    try {
        // Step 1: Send OTP for advertiser verification (with all advertiser data)
        console.log('Step 1: Sending OTP for advertiser verification (with all data)...');
        const otpResponse = await axios.post(`${BASE_URL}/send-otp`, testAdvertiser);
        
        if (otpResponse.data.otp) {
            logResult('Send OTP for Advertiser', true, { otp: otpResponse.data.otp });
            
            // Step 2: Verify OTP and create account (only OTP + basic info needed)
            console.log('Step 2: Verifying OTP and creating advertiser account...');
            const verifyResponse = await axios.post(`${BASE_URL}/verify-otp`, {
                otp: otpResponse.data.otp,
                phone: testAdvertiser.phone,
                type: testAdvertiser.type,
                userType: testAdvertiser.userType
            });
            
            logResult('Verify OTP and Create Advertiser Account', true, {
                id: verifyResponse.data.user.id,
                token: verifyResponse.data.token ? 'JWT_TOKEN_RECEIVED' : 'NO_TOKEN'
            });
            
            return verifyResponse.data.token;
        } else {
            logResult('Send OTP for Advertiser', false, null, 'No OTP received in response');
            return null;
        }
    } catch (error) {
        logResult('Advertiser Registration Flow', false, null, error.response?.data?.error || error.message);
        return null;
    }
};

// Test Login Flow
const testLogin = async (phone, userType) => {
    console.log(`\n🔐 TESTING LOGIN FLOW FOR ${userType.toUpperCase()}`);
    console.log('═'.repeat(50));

    try {
        const loginResponse = await axios.post(`${BASE_URL}/login`, {
            phone: phone,
            password: TEST_PASSWORD
        });
        
        logResult(`Login ${userType}`, true, {
            id: loginResponse.data.user.id,
            type: loginResponse.data.user.type,
            token: loginResponse.data.token ? 'JWT_TOKEN_RECEIVED' : 'NO_TOKEN'
        });
        
        return loginResponse.data.token;
    } catch (error) {
        logResult(`Login ${userType}`, false, null, error.response?.data?.error || error.message);
        return null;
    }
};

// Test Password Reset Flow
const testPasswordReset = async (phone, userType) => {
    console.log(`\n🔑 TESTING PASSWORD RESET FLOW FOR ${userType.toUpperCase()}`);
    console.log('═'.repeat(50));

    try {
        // Step 1: Request password reset
        console.log('Step 1: Requesting password reset...');
        const forgotResponse = await axios.post(`${BASE_URL}/forgot-password`, {
            phone: phone,
            userType: userType
        });
        
        if (forgotResponse.data.otp) {
            logResult('Request Password Reset', true, { otp: forgotResponse.data.otp });
            
            // Step 2: Reset password
            console.log('Step 2: Resetting password...');
            const resetResponse = await axios.post(`${BASE_URL}/reset-password`, {
                phone: phone,
                otp: forgotResponse.data.otp,
                newPassword: 'newpassword123',
                userType: userType
            });
            
            logResult('Reset Password', true, resetResponse.data);
            return true;
        } else {
            logResult('Request Password Reset', false, null, 'No OTP received in response');
            return false;
        }
    } catch (error) {
        logResult('Password Reset Flow', false, null, error.response?.data?.error || error.message);
        return false;
    }
};

// Test Protected Routes
const testProtectedRoutes = async (token, userType) => {
    console.log(`\n🔒 TESTING PROTECTED ROUTES FOR ${userType.toUpperCase()}`);
    console.log('═'.repeat(50));

    try {
        // Get profile
        console.log('Testing get profile...');
        const profileResponse = await axios.get(`${BASE_URL}/profile`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        logResult('Get Profile', true, {
            id: profileResponse.data.user.id,
            type: profileResponse.data.user.type,
            full_name: profileResponse.data.user.full_name
        });
        
        // Update profile
        console.log('Testing update profile...');
        const updateData = {
            displayName: `Updated ${userType}`,
            bio: `This is an updated ${userType} profile`,
            website: 'https://example.com',
            location: 'Test City'
        };
        
        const updateResponse = await axios.put(`${BASE_URL}/profile`, updateData, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        logResult('Update Profile', true, updateResponse.data);
        return true;
    } catch (error) {
        logResult('Protected Routes', false, null, error.response?.data?.error || error.message);
        return false;
    }
};

// Main test function
const runTests = async () => {
    console.log('🚀 STARTING AUTHENTICATION FLOW TESTS');
    console.log('═'.repeat(50));
    
    try {
        // Test User Registration
        const userToken = await testUserRegistration();
        
        // Test Advertiser Registration
        const advertiserToken = await testAdvertiserRegistration();
        
        // Test Login for both
        if (userToken) {
            await testLogin(testUser.phone, 'user');
        }
        
        if (advertiserToken) {
            await testLogin(testAdvertiser.phone, 'advertiser');
        }
        
        // Test Password Reset for both
        await testPasswordReset(testUser.phone, 'user');
        await testPasswordReset(testAdvertiser.phone, 'advertiser');
        
        // Test Protected Routes
        if (userToken) {
            await testProtectedRoutes(userToken, 'user');
        }
        
        if (advertiserToken) {
            await testProtectedRoutes(advertiserToken, 'advertiser');
        }
        
        console.log('\n🎉 ALL TESTS COMPLETED!');
        console.log('═'.repeat(50));
        
    } catch (error) {
        console.error('\n💥 TEST SUITE FAILED:', error.message);
    }
};

// Run tests if this file is executed directly
if (require.main === module) {
    runTests();
}

module.exports = {
    testUserRegistration,
    testAdvertiserRegistration,
    testLogin,
    testPasswordReset,
    testProtectedRoutes,
    runTests
};



