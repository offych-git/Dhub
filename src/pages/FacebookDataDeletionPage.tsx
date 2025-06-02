import React from 'react';

const FacebookDataDeletionPage: React.FC = () => {
    return (
        <div style={{
            fontFamily: 'Arial, sans-serif',
            lineHeight: 1.6,
            margin: '20px',
            padding: 0,
            backgroundColor: '#f4f4f4',
            color: '#333'
        }}>
            <div style={{
                maxWidth: '800px',
                margin: 'auto',
                background: '#fff',
                padding: '30px',
                borderRadius: '8px',
                boxShadow: '0 0 10px rgba(0,0,0,0.1)'
            }}>
                <h1 style={{
                    color: '#3b5998', // Facebook blue
                    textAlign: 'center',
                    marginBottom: '30px'
                }}>Facebook Data Deletion Instructions</h1>

                <p>If you signed up or logged in using Facebook and wish to delete your data from our website, you can do it directly from your account settings:</p>

                <ul style={{ listStyle: 'none', padding: 0 }}>
                    <li style={{ marginBottom: '10px', paddingLeft: '20px', position: 'relative' }}>
                        <span style={{ content: '"•"', color: '#3b5998', position: 'absolute', left: 0 }}>•</span> Log in to our website.
                    </li>
                    <li style={{ marginBottom: '10px', paddingLeft: '20px', position: 'relative' }}>
                        <span style={{ content: '"•"', color: '#3b5998', position: 'absolute', left: 0 }}>•</span> Go to **User Settings**.
                    </li>
                    <li style={{ marginBottom: '10px', paddingLeft: '20px', position: 'relative' }}>
                        <span style={{ content: '"•"', color: '#3b5998', position: 'absolute', left: 0 }}>•</span> Click on "**Delete Account**".
                    </li>
                </ul>
                <p>This will permanently delete your account and all associated data from our servers.</p>

                <h2 style={{
                    color: '#555',
                    marginTop: '25px',
                    marginBottom: '15px'
                }}>Alternatively, you can also remove the app from your Facebook settings:</h2>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                    <li style={{ marginBottom: '10px', paddingLeft: '20px', position: 'relative' }}>
                        <span style={{ content: '"•"', color: '#3b5998', position: 'absolute', left: 0 }}>•</span> Go to **Settings & Privacy** > **Settings**.
                    </li>
                    <li style={{ marginBottom: '10px', paddingLeft: '20px', position: 'relative' }}>
                        <span style={{ content: '"•"', color: '#3b5998', position: 'absolute', left: 0 }}>•</span> Click on **Apps and Websites**.
                    </li>
                    <li style={{ marginBottom: '10px', paddingLeft: '20px', position: 'relative' }}>
                        <span style={{ content: '"•"', color: '#3b5998', position: 'absolute', left: 0 }}>•</span> Find our app and click **Remove**.
                    </li>
                </ul>

                <p style={{
                    fontStyle: 'italic',
                    color: '#777',
                    textAlign: 'center',
                    marginTop: '40px'
                }}>For further assistance or information, please contact our support team.</p>
            </div>
        </div>
    );
};

export default FacebookDataDeletionPage;