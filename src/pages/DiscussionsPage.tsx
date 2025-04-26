import React from 'react';
import { MessageSquare, ThumbsUp } from 'lucide-react';

const DiscussionsPage: React.FC = () => {
  // Mock discussions
  const discussions = [
    {
      id: '1',
      title: 'Best deals on gaming monitors this month?',
      author: {
        name: 'TechDeals',
        avatar: 'https://i.pravatar.cc/150?img=5'
      },
      createdAt: '2 hours ago',
      comments: 24,
      likes: 18,
    },
    {
      id: '2',
      title: 'Has anyone used the 20% off coupon at Best Buy lately?',
      author: {
        name: 'DealHunter',
        avatar: 'https://i.pravatar.cc/150?img=1'
      },
      createdAt: '5 hours ago',
      comments: 15,
      likes: 9,
    },
    {
      id: '3',
      title: 'Amazon Prime Day predictions and discussion thread',
      author: {
        name: 'BargainFinder',
        avatar: 'https://i.pravatar.cc/150?img=3'
      },
      createdAt: '1 day ago',
      comments: 47,
      likes: 32,
    },
  ];

  return (
    <div className="pb-16 pt-24 bg-gray-900 min-h-screen">
      <div className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-white text-xl font-medium">Popular Discussions</h2>
          <button className="bg-orange-500 text-white px-4 py-2 rounded-md text-sm font-medium">
            New Post
          </button>
        </div>
        
        <div className="space-y-4">
          {discussions.map(discussion => (
            <div 
              key={discussion.id} 
              className="bg-gray-800 rounded-lg p-4"
            >
              <h3 className="text-white font-medium">{discussion.title}</h3>
              
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-8 h-8 rounded-full overflow-hidden mr-2">
                    <img 
                      src={discussion.author.avatar} 
                      alt={discussion.author.name} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <div className="text-white text-sm">{discussion.author.name}</div>
                    <div className="text-gray-500 text-xs">{discussion.createdAt}</div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="flex items-center text-gray-400">
                    <MessageSquare className="h-4 w-4 mr-1" />
                    <span>{discussion.comments}</span>
                  </div>
                  <div className="flex items-center text-gray-400">
                    <ThumbsUp className="h-4 w-4 mr-1" />
                    <span>{discussion.likes}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DiscussionsPage;