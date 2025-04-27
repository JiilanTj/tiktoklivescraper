'use client';

import { useEffect } from 'react';
import { io } from 'socket.io-client';

interface UserActivity {
  username: string;
  userId: string;
  timestamp: Date;
  type: 'chat' | 'like';
}

interface CrowdSprite extends Phaser.GameObjects.Sprite {
  outlineSprite?: Phaser.GameObjects.Sprite;
  labels?: Phaser.GameObjects.Text[];
}

interface Baris2User {
  username: string;
  userId: string;
  isCommenter?: boolean;
  isLiker?: boolean;
}

interface Baris1User {
  username: string;
  userId: string;
  totalDiamonds: number;
}

export default function GameComponent() {
  useEffect(() => {
    let isComponentMounted = true;
    const socket = io('http://localhost:5000');
    let baris2Users: Baris2User[] = [];
    let baris1Users: Baris1User[] = [];
    let activities: UserActivity[] = [];
    let gameScene: any = null;
    let game: any = null;

    // Fungsi untuk mendapatkan 28 username unik terbaru
    const getUniqueUsernames = (activities: UserActivity[]): string[] => {
      const uniqueUsernames = new Set<string>();
      const result: string[] = [];
      
      const sortedActivities = [...activities].sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      
      for (const activity of sortedActivities) {
        if (result.length >= 28) break;
        
        if (!uniqueUsernames.has(activity.username)) {
          uniqueUsernames.add(activity.username);
          result.push(activity.username);
        }
      }
      
      return result;
    };

    // Fungsi untuk fetch activities
    const fetchActivities = async () => {
      if (!isComponentMounted) return;
      
      try {
        const response = await fetch('http://localhost:5000/api/users/activities');
        const data = await response.json();
        
        if (!isComponentMounted) return;
        
        activities = data;
        const uniqueUsernames = getUniqueUsernames(activities);
        baris2Users = uniqueUsernames.map(username => ({
          username,
          userId: username
        }));
        
        // Update scene jika sudah tersedia
        if (gameScene && gameScene.scene && isComponentMounted) {
          gameScene.currentBaris2Data = baris2Users;
          gameScene.updateBaris2Labels();
        }
        
        if (isComponentMounted) {
          socket.emit('update-baris2', baris2Users);
        }
      } catch (error) {
        if (isComponentMounted) {
          console.error('Error fetching activities:', error);
        }
      }
    };

    // Initial fetch
    fetchActivities();

    // Set up polling interval dengan interval lebih pendek
    const pollInterval = setInterval(fetchActivities, 1000);

    const initPhaser = async () => {
      try {
        if (!isComponentMounted) return;
        
        const Phaser = (await import('phaser')).default;

        class CharacterScene extends Phaser.Scene {
          private body!: Phaser.GameObjects.Image;
          private head!: Phaser.GameObjects.Sprite;
          private hostText!: Phaser.GameObjects.Text;
          private djStand!: Phaser.GameObjects.Image;
          private vinyl!: Phaser.GameObjects.Sprite;
          private vinylLeft!: Phaser.GameObjects.Sprite;
          private vinylRight!: Phaser.GameObjects.Sprite;
          private background!: Phaser.GameObjects.Rectangle;
          private equalizers: Phaser.GameObjects.Sprite[] = [];
          private equalizerTimer!: Phaser.Time.TimerEvent;
          private readonly NUMBER_OF_EQUALIZERS = 5;
          private readonly EQUALIZER_SPACING = 300;
          private strobes: Phaser.GameObjects.Sprite[] = [];
          private strobeTimer!: Phaser.Time.TimerEvent;
          private characterTween!: Phaser.Tweens.Tween;
          private crowds: CrowdSprite[] = [];
          private readonly CROWD_SPACING = 600;
          private width!: number;
          private height!: number;
          private centerX!: number;
          private centerY!: number;
          private bodyOffset!: number;
          private headOffset!: number;
          private standY!: number;
          private spacingLeft!: number;
          private spacingRight!: number;
          private heightOffset!: number;
          private moveTowardsCenterOffset!: number;
          private additionalCenterOffset!: number;
          private fineAdjustmentOffset!: number;
          private personWidth!: number;
          private labelY!: number;
          private crowdY!: number;
          private crowdRow2Y!: number;
          private crowdRow3Y!: number;
          private characterScale!: number;
          private djStandScale!: number;
          private crowdScale!: number;
          private equalizerScale!: number;
          private baris2Labels: Phaser.GameObjects.Text[] = [];
          private baris1Labels: Phaser.GameObjects.Text[] = [];
          private currentBaris2Data: Baris2User[] = [];
          private currentBaris1Data: Baris1User[] = [];

          constructor() {
            super({ key: 'CharacterScene' });
          }

          preload() {
            this.load.image('body', '/assets/host/Body.png');
            this.load.spritesheet('head', '/assets/host/Head.png', {
              frameWidth: 24,
              frameHeight: 24
            });
            this.load.image('djstand', '/assets/host/DJ_Stand.png');
            
            this.load.spritesheet('vinyl', '/assets/host/Spinning_Vinyl_strip9.png', {
              frameWidth: 48,
              frameHeight: 24
            });

            // Load equalizer spritesheet
            this.load.spritesheet('equalizer', '/assets/effects/Equalizer_strip6.png', {
              frameWidth: 256,
              frameHeight: 192
            });

            // Load strobe effect spritesheet
            this.load.spritesheet('strobe', '/assets/effects/Blue_and_Red_Strobe_strip8.png', {
              frameWidth: 256,
              frameHeight: 192
            });

            // Load crowd silhouettes
            this.load.spritesheet('crowd_blue', '/assets/crowd/Male_Siloutte_DBlue_strip4.png', {
              frameWidth: 256,
              frameHeight: 96
            });
            this.load.spritesheet('crowd_pink', '/assets/crowd/Male_Siloutte_Pink_strip4.png', {
              frameWidth: 256,
              frameHeight: 96
            });
            this.load.spritesheet('crowd_lblue', '/assets/crowd/Male_Siloutte_LBlue_strip4.png', {
              frameWidth: 256,
              frameHeight: 96
            });
          }

          private updateResponsiveValues() {
            this.width = this.cameras.main.width;
            this.height = this.cameras.main.height;
            this.centerX = this.width / 2;
            this.centerY = this.height / 2;

            // Update all measurements relative to screen size
            this.bodyOffset = this.height * 0.2;
            this.headOffset = this.height * 0.07;
            this.standY = this.centerY - (this.height * 0.1);
            this.spacingLeft = this.width * 0.06;
            this.spacingRight = this.width * 0.06;
            this.heightOffset = this.height * 0.025;

            // Crowd positioning calculations - Increased horizontal spacing
            this.moveTowardsCenterOffset = this.width * 0.15; // Increased from 0.1 to 0.15
            this.additionalCenterOffset = this.width * 0.08; // Increased from 0.06 to 0.08
            this.fineAdjustmentOffset = this.width * 0.06; // Increased from 0.04 to 0.06
            this.personWidth = this.width * 0.05;

            // Label positioning
            this.labelY = this.centerY - (this.height * 0.3);
            this.crowdY = this.centerY + (this.height * 0.07);
            this.crowdRow2Y = this.centerY + (this.height * 0.23);
            this.crowdRow3Y = this.centerY + (this.height * 0.39);

            // Scaling calculations
            this.characterScale = Math.min(this.width, this.height) * 0.002;
            this.djStandScale = Math.min(this.width, this.height) * 0.0018;
            this.crowdScale = Math.min(this.width, this.height) * 0.002;
            this.equalizerScale = Math.min(this.width, this.height) * 0.0014;
          }

          create() {
            // Simpan reference ke scene
            gameScene = this;
            this.updateResponsiveValues();

            // Add black background first (before any other elements)
            this.background = this.add.rectangle(0, 0, this.width, this.height, 0x000000);
            this.background.setOrigin(0, 0);
            this.background.setDepth(-1);

            // Calculate base positions for crowds with unique names
            const initialBaseLeftX = (this.width / 4) + this.moveTowardsCenterOffset;
            const initialBaseRightX = ((this.width * 3) / 4) - this.moveTowardsCenterOffset;

            // Calculate final positions with all offsets
            const initialLeftSideX = initialBaseLeftX + this.additionalCenterOffset - this.fineAdjustmentOffset;
            const initialRightSideX = initialBaseRightX - this.additionalCenterOffset + this.fineAdjustmentOffset;

            // Create strobe animations with different speeds
            if (!this.anims.exists('strobe_effect_normal')) {
              this.anims.create({
                key: 'strobe_effect_normal',
                frames: this.anims.generateFrameNumbers('strobe', { 
                  start: 0,
                  end: 7
                }),
                frameRate: 12,
                repeat: -1
              });
            }

            if (!this.anims.exists('strobe_effect_fast')) {
              this.anims.create({
                key: 'strobe_effect_fast',
                frames: this.anims.generateFrameNumbers('strobe', { 
                  start: 0,
                  end: 7
                }),
                frameRate: 16,
                repeat: -1
              });
            }

            // Add multiple strobe sprites in different positions
            const strobePositions = [
              { x: this.centerX - 200, y: this.centerY - this.bodyOffset + 50, scale: 1.2 },
              { x: this.centerX + 200, y: this.centerY - this.bodyOffset + 50, scale: 1.2 },
              { x: this.centerX, y: this.centerY - this.bodyOffset, scale: 1.5 }
            ];

            strobePositions.forEach(pos => {
              const strobe = this.add.sprite(pos.x, pos.y, 'strobe');
              strobe.setScale(pos.scale);
              strobe.setBlendMode(Phaser.BlendModes.ADD);
              strobe.setAlpha(0.8);
              strobe.setDepth(-0.8); // Behind the DJ but in front of background
              this.strobes.push(strobe);
            });

            // Start random strobe animations
            this.randomizeStrobeEffects();
            
            // Set up timer to change strobe animations
            this.strobeTimer = this.time.addEvent({
              delay: 3000, // Change effects every 3 seconds
              callback: this.randomizeStrobeEffects,
              callbackScope: this,
              loop: true
            });

            // Create equalizer animations with different speeds
            if (!this.anims.exists('equalize_slow')) {
              this.anims.create({
                key: 'equalize_slow',
                frames: this.anims.generateFrameNumbers('equalizer', { 
                  start: 0,
                  end: 5
                }),
                frameRate: 8,
                repeat: -1
              });
            }

            if (!this.anims.exists('equalize_normal')) {
              this.anims.create({
                key: 'equalize_normal',
                frames: this.anims.generateFrameNumbers('equalizer', { 
                  start: 0,
                  end: 5
                }),
                frameRate: 12,
                repeat: -1
              });
            }

            if (!this.anims.exists('equalize_fast')) {
              this.anims.create({
                key: 'equalize_fast',
                frames: this.anims.generateFrameNumbers('equalizer', { 
                  start: 0,
                  end: 5
                }),
                frameRate: 16,
                repeat: -1
              });
            }

            // Add equalizer sprites - positioned horizontally behind the body
            const equalizerY = this.centerY - this.bodyOffset + 40; // Increased offset by 10px
            const totalWidth = this.EQUALIZER_SPACING * (this.NUMBER_OF_EQUALIZERS - 1);
            const startX = this.centerX - totalWidth / 2;

            for (let i = 0; i < this.NUMBER_OF_EQUALIZERS; i++) {
              const equalizer = this.add.sprite(
                startX + (i * this.EQUALIZER_SPACING),
                equalizerY,
                'equalizer'
              );
              equalizer.setScale(1.4);
              equalizer.setDepth(-0.8); // Move equalizers more to the back
              this.equalizers.push(equalizer);
            }
            
            // Start random animation changes for all equalizers
            this.randomizeEqualizerAnimation();
            
            // Set up timer to change animation randomly
            this.equalizerTimer = this.time.addEvent({
              delay: 2000, // Change animation every 2 seconds
              callback: this.randomizeEqualizerAnimation,
              callbackScope: this,
              loop: true
            });

            // Create and scale the DJ stand first
            this.djStand = this.add.image(this.centerX, this.centerY - 70, 'djstand');
            this.djStand.setOrigin(0.5);
            const djStandScale = 1.8;
            this.djStand.setScale(djStandScale);

            // Row 1 (Baris Depan) - Blue silhouettes with Baris 1 data
            const leftCrowdRow1 = this.add.sprite(
              this.centerX - (this.width * 0.20),
              this.crowdY,
              'crowd_blue'
            ) as CrowdSprite;
            leftCrowdRow1.setScale(this.crowdScale);
            leftCrowdRow1.setDepth(-0.3);
            leftCrowdRow1.play('crowd_dance_blue');
            this.crowds.push(leftCrowdRow1);

            // Create labels for Row 1 left
            leftCrowdRow1.labels = this.createBaris1Labels(
              this.centerX - (this.width * 0.20),
              this.crowdY,
              0
            );
            this.baris1Labels.push(...(leftCrowdRow1.labels || []));

            const rightCrowdRow1 = this.add.sprite(
              this.centerX + (this.width * 0.20),
              this.crowdY,
              'crowd_blue'
            ) as CrowdSprite;
            rightCrowdRow1.setScale(this.crowdScale);
            rightCrowdRow1.setDepth(-0.3);
            rightCrowdRow1.play('crowd_dance_blue');
            this.crowds.push(rightCrowdRow1);

            // Create labels for Row 1 right
            rightCrowdRow1.labels = this.createBaris1Labels(
              this.centerX + (this.width * 0.20),
              this.crowdY,
              7
            );
            this.baris1Labels.push(...(rightCrowdRow1.labels || []));

            // Stage Crowd Left
            const djCrowdLeft = this.add.sprite(
              this.centerX - 450,
              this.centerY - 170,
              'crowd_blue'
            ) as CrowdSprite;
            djCrowdLeft.setScale(this.crowdScale);
            djCrowdLeft.setDepth(-0.3);
            djCrowdLeft.play('crowd_dance_blue');
            this.crowds.push(djCrowdLeft);

            // Create labels for left stage crowd with higher position
            const leftStageCrowdLabels = this.createStageCrowdLabels(
              this.centerX - 450,
              this.centerY - 170,
              'Orang'
            );

            // Stage Crowd Right
            const djCrowdRight = this.add.sprite(
              this.centerX + 450,
              this.centerY - 170,
              'crowd_blue'
            ) as CrowdSprite;
            djCrowdRight.setScale(this.crowdScale);
            djCrowdRight.setDepth(-0.3);
            djCrowdRight.play('crowd_dance_blue');
            this.crowds.push(djCrowdRight);

            // Create labels for right stage crowd with higher position
            const rightStageCrowdLabels = this.createStageCrowdLabels(
              this.centerX + 450,
              this.centerY - 170,
              'Orang'
            );

            // Create vinyl animation if it doesn't exist
            if (!this.anims.exists('vinyl_spin')) {
              this.anims.create({
                key: 'vinyl_spin',
                frames: this.anims.generateFrameNumbers('vinyl', {
                  start: 0,
                  end: 7,
                }),
                frameRate: 10,
                repeat: -1,
              });
            }

            // Helper function to create and setup vinyl sprites
            const createVinylSprite = (x: number, y: number) => {
              const vinyl = this.add.sprite(x, y, 'vinyl');
              vinyl.setScale(0.5);
              vinyl.setDepth(0.1);
              vinyl.play('vinyl_spin');
              return vinyl;
            };

            // Create vinyl sprites
            this.vinylLeft = createVinylSprite(this.centerX - 450, this.centerY - 170);
            this.vinylRight = createVinylSprite(this.centerX + 450, this.centerY - 170);

            // Character slightly higher
            this.body = this.add.image(this.centerX, this.centerY - this.bodyOffset, 'body');
            this.body.setOrigin(0.5);
            
            this.head = this.add.sprite(this.centerX, this.centerY - this.bodyOffset - this.headOffset, 'head');
            this.head.setOrigin(0.5);

            const characterScale = 2.0;

            this.body.setScale(this.characterScale);
            this.head.setScale(this.characterScale);

            // Add HOST text with retro style
            this.hostText = this.add.text(this.centerX, this.centerY - 300, 'HOST', {
              fontFamily: 'Arial',
              fontSize: '32px',
              color: '#ffffff'
            });
            this.hostText.setOrigin(0.5);

            // Add floating animation to character and text
            this.characterTween = this.tweens.add({
              targets: [this.body, this.head, this.hostText],
              y: '+=4',
              duration: 100,
              ease: 'Sine.easeInOut',
              yoyo: true,
              repeat: -1
            });

            // Create crowd animation for both colors
            if (!this.anims.exists('crowd_dance_blue')) {
              this.anims.create({
                key: 'crowd_dance_blue',
                frames: this.anims.generateFrameNumbers('crowd_blue', {
                  start: 0,
                  end: 3
                }),
                frameRate: 4,
                repeat: -1
              });
            }

            if (!this.anims.exists('crowd_dance_pink')) {
              this.anims.create({
                key: 'crowd_dance_pink',
                frames: this.anims.generateFrameNumbers('crowd_pink', {
                  start: 0,
                  end: 3
                }),
                frameRate: 4,
                repeat: -1
              });
            }

            if (!this.anims.exists('crowd_dance_lblue')) {
              this.anims.create({
                key: 'crowd_dance_lblue',
                frames: this.anims.generateFrameNumbers('crowd_lblue', {
                  start: 0,
                  end: 3
                }),
                frameRate: 4,
                repeat: -1
              });
            }

            // Row 2 (Baris Tengah) - Pink Silhouettes - First 14 users
            const leftCrowdRow2 = this.add.sprite(
              this.centerX - (this.width * 0.20),
              this.crowdRow2Y,
              'crowd_pink'
            ) as CrowdSprite;
            leftCrowdRow2.setScale(this.crowdScale * 0.95);
            leftCrowdRow2.setDepth(-0.2);
            leftCrowdRow2.play('crowd_dance_pink');
            this.crowds.push(leftCrowdRow2);

            // Labels for left side of Row 2 (first 7 users)
            leftCrowdRow2.labels = this.createCrowdLabels(
              this.centerX - (this.width * 0.20),
              this.crowdRow2Y,
              'Baris 2',
              0
            );

            const rightCrowdRow2 = this.add.sprite(
              this.centerX + (this.width * 0.20),
              this.crowdRow2Y,
              'crowd_pink'
            ) as CrowdSprite;
            rightCrowdRow2.setScale(this.crowdScale * 0.95);
            rightCrowdRow2.setDepth(-0.2);
            rightCrowdRow2.play('crowd_dance_pink');
            this.crowds.push(rightCrowdRow2);

            // Labels for right side of Row 2 (next 7 users)
            rightCrowdRow2.labels = this.createCrowdLabels(
              this.centerX + (this.width * 0.20),
              this.crowdRow2Y,
              'Baris 2',
              7
            );

            // Row 3 (Baris Belakang) - Light Blue Silhouettes - Last 14 users
            const leftCrowdRow3 = this.add.sprite(
              this.centerX - (this.width * 0.20),
              this.crowdRow3Y,
              'crowd_lblue'
            ) as CrowdSprite;
            leftCrowdRow3.setScale(this.crowdScale * 0.9);
            leftCrowdRow3.setDepth(-0.1);
            leftCrowdRow3.play('crowd_dance_lblue');
            this.crowds.push(leftCrowdRow3);

            // Labels for left side of Row 3 (next 7 users)
            leftCrowdRow3.labels = this.createCrowdLabels(
              this.centerX - (this.width * 0.20),
              this.crowdRow3Y,
              'Baris 2',
              14
            );

            const rightCrowdRow3 = this.add.sprite(
              this.centerX + (this.width * 0.20),
              this.crowdRow3Y,
              'crowd_lblue'
            ) as CrowdSprite;
            rightCrowdRow3.setScale(this.crowdScale * 0.9);
            rightCrowdRow3.setDepth(-0.1);
            rightCrowdRow3.play('crowd_dance_lblue');
            this.crowds.push(rightCrowdRow3);

            // Labels for right side of Row 3 (last 7 users)
            rightCrowdRow3.labels = this.createCrowdLabels(
              this.centerX + (this.width * 0.20),
              this.crowdRow3Y,
              'Baris 2',
              21
            );

            // Store all labels for updating
            this.baris2Labels = [
              ...(leftCrowdRow2.labels || []),
              ...(rightCrowdRow2.labels || []),
              ...(leftCrowdRow3.labels || []),
              ...(rightCrowdRow3.labels || [])
            ];

            // Socket listener untuk Baris 2
            socket.on('update-baris2', (data: Baris2User[]) => {
              this.currentBaris2Data = data.slice(0, 28);
              this.updateBaris2Labels();
            });

            // Socket listener baru untuk Baris 1
            socket.on('update-baris1', (data: Baris1User[]) => {
              this.currentBaris1Data = data;
              this.updateBaris1Labels();
            });

            // Add slight up and down movement to all crowds
            this.crowds.forEach((crowd, index) => {
              const delay = Math.random() * 1000;
              
              // Add movement to crowd
              this.tweens.add({
                targets: [crowd, crowd.outlineSprite].filter(Boolean),
                y: '+=8',
                duration: 1000,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1,
                delay: delay
              });

              // Add movement to labels if it's the first crowd (left front)
              if (index === 0 && leftCrowdRow2.labels) {
                leftCrowdRow2.labels.forEach(label => {
                  this.tweens.add({
                    targets: label,
                    y: '+=8',
                    duration: 1000,
                    ease: 'Sine.easeInOut',
                    yoyo: true,
                    repeat: -1,
                    delay: delay
                  });
                });
              }
            });

            // Update scales di bagian yang relevan
            this.djStand.setScale(djStandScale);
            this.body.setScale(this.characterScale);
            this.head.setScale(this.characterScale);

            // Update crowd scales
            this.crowds.forEach(crowd => {
              crowd.setScale(2.2);
            });

            // Update equalizer scales
            this.equalizers.forEach(equalizer => {
              equalizer.setScale(1.4);
            });

            this.scale.on('resize', this.handleResize, this);
          }

          private handleResize(gameSize: Phaser.Structs.Size) {
            this.updateResponsiveValues();
            
            if (this.body && this.head && this.djStand) {
              // Stop existing tween before repositioning
              if (this.characterTween) {
                this.characterTween.stop();
                this.characterTween.remove();
              }

              // Update background size
              if (this.background) {
                this.background.setSize(this.width, this.height);
              }

              // Update positions using class properties
              this.body.setPosition(this.centerX, this.centerY - this.bodyOffset);
              this.head.setPosition(this.centerX, (this.centerY - this.bodyOffset) - this.headOffset);
              this.hostText.setPosition(this.centerX, (this.centerY - this.bodyOffset) - this.headOffset - 35);
              this.djStand.setPosition(this.centerX, this.standY);

              // Update scales
              this.body.setScale(this.characterScale);
              this.head.setScale(this.characterScale);
              this.djStand.setScale(this.djStandScale);

              // Update vinyl positions
              if (this.vinylLeft) {
                this.vinylLeft.setPosition(this.centerX - this.spacingLeft, this.standY - this.heightOffset);
              }
              if (this.vinylRight) {
                this.vinylRight.setPosition(this.centerX + this.spacingRight, this.standY - this.heightOffset);
              }

              // Restart floating animation
              this.characterTween = this.tweens.add({
                targets: [this.body, this.head, this.hostText],
                y: '+=4',
                duration: 300,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1
              });
            }

            // Update crowd positions with unique variable names
            if (this.crowds.length > 0) {
              const updatedBaseLeftX = (this.width / 4) + this.moveTowardsCenterOffset;
              const updatedBaseRightX = ((this.width * 3) / 4) - this.moveTowardsCenterOffset;
              
              const updatedLeftSideX = updatedBaseLeftX + this.additionalCenterOffset - this.fineAdjustmentOffset;
              const updatedRightSideX = updatedBaseRightX - this.additionalCenterOffset + this.fineAdjustmentOffset;
              
              this.crowds.forEach((crowd, index) => {
                const isRightSide = index % 2 === 1;
                const rowNumber = Math.floor(index / 2);
                const xPos = isRightSide ? updatedRightSideX : updatedLeftSideX;
                const yPos = this.centerY + (this.height * 0.15) + (rowNumber * (this.height * 0.15));
                
                crowd.setPosition(xPos, yPos);
                crowd.setScale(this.crowdScale);
              });
            }

            // Update equalizer positions and scales
            this.equalizers.forEach((equalizer, index) => {
              const totalWidth = this.EQUALIZER_SPACING * (this.NUMBER_OF_EQUALIZERS - 1);
              const startX = this.centerX - totalWidth / 2;
              equalizer.setPosition(startX + (index * this.EQUALIZER_SPACING), this.centerY - this.bodyOffset + 40);
              equalizer.setScale(this.equalizerScale);
            });
          }

          private randomizeEqualizerAnimation() {
            // Random animation selection
            const animations = ['equalize_slow', 'equalize_normal', 'equalize_fast'];
            
            this.equalizers.forEach(equalizer => {
              if (!equalizer) return;

              const randomAnim = animations[Math.floor(Math.random() * animations.length)];
              const randomDelay = Math.random() * 500; // 0-500ms delay
              const randomSpeed = 0.8 + Math.random() * 0.4; // 0.8-1.2 speed multiplier
              
              this.time.delayedCall(randomDelay, () => {
                if (equalizer) {
                  equalizer.play(randomAnim);
                  equalizer.anims.timeScale = randomSpeed;
                }
              });
            });
          }

          private randomizeStrobeEffects() {
            this.strobes.forEach(strobe => {
              // Random animation selection
              const animations = ['strobe_effect_normal', 'strobe_effect_fast'];
              const randomAnim = animations[Math.floor(Math.random() * animations.length)];
              
              // Random delay and alpha variation
              const randomDelay = Math.random() * 500;
              const randomAlpha = 0.6 + Math.random() * 0.4; // 0.6-1.0 alpha
              
              this.time.delayedCall(randomDelay, () => {
                if (strobe) {
                  strobe.play(randomAnim);
                  strobe.setAlpha(randomAlpha);
                }
              });
            });
          }

          private createCrowdLabels(crowdX: number, crowdY: number, rowPrefix: string, startIndex: number = 0): Phaser.GameObjects.Text[] {
            const crowdWidth = 256 * this.crowdScale;
            const totalLabelSpacing = crowdWidth * 1.1;
            const offsetX = rowPrefix === 'Baris 2' ? -35 : 0;
            const labelStartX = crowdX - (totalLabelSpacing / 2) + offsetX;
            const labelSpacing = totalLabelSpacing / (rowPrefix === 'Baris 2' ? 5.2 : 6);
            
            const labels: Phaser.GameObjects.Text[] = [];

            for (let i = 1; i <= 7; i++) {
              const userIndex = startIndex + i - 1;
              const user = baris2Users[userIndex];
              let labelText = user ? user.username : 'Guest';
              
              const personLabel = this.add.text(
                labelStartX + ((i-1) * labelSpacing),
                crowdY - (crowdWidth * 0.27),
                labelText,
                {
                  fontFamily: 'Arial',
                  fontSize: `${Math.max(Math.min(this.width * 0.008, 12), 8)}px`,
                  color: '#ffffff',
                  stroke: '#000000',
                  strokeThickness: 2,
                  shadow: { 
                    color: '#000000',
                    fill: true,
                    blur: 1,
                    offsetX: 1,
                    offsetY: 1
                  }
                }
              );
              personLabel.setOrigin(0.5);
              personLabel.setDepth(999);
              
              this.tweens.add({
                targets: personLabel,
                y: '+=4',
                duration: 1000,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1
              });
              
              labels.push(personLabel);
            }
            return labels;
          }

          private createStageCrowdLabels(crowdX: number, crowdY: number, rowPrefix: string): Phaser.GameObjects.Text[] {
            const crowdWidth = 256 * this.crowdScale;
            const totalLabelSpacing = crowdWidth * 1.1;
            const labelStartX = crowdX - (totalLabelSpacing / 2);
            const labelSpacing = totalLabelSpacing / 6;
            
            const labels: Phaser.GameObjects.Text[] = [];

            for (let i = 1; i <= 7; i++) {
              const personLabel = this.add.text(
                labelStartX + ((i-1) * labelSpacing),
                crowdY - (crowdWidth * 0.31), // Reduced height from 0.35 to 0.31 for stage crowd labels
                `${rowPrefix} ${i}`,
                {
                  fontFamily: 'Arial',
                  fontSize: `${Math.max(Math.min(this.width * 0.008, 12), 8)}px`,
                  color: '#ffffff',
                  stroke: '#000000',
                  strokeThickness: 2,
                  shadow: { 
                    color: '#000000',
                    fill: true,
                    blur: 1,
                    offsetX: 1,
                    offsetY: 1
                  }
                }
              );
              personLabel.setOrigin(0.5);
              personLabel.setDepth(999);
              
              this.tweens.add({
                targets: personLabel,
                y: '+=4',
                duration: 1000,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1
              });
              
              labels.push(personLabel);
            }
            return labels;
          }

          // New function for creating default labels (without baris2 data)
          private createDefaultLabels(crowdX: number, crowdY: number, prefix: string): Phaser.GameObjects.Text[] {
            const crowdWidth = 256 * this.crowdScale;
            const totalLabelSpacing = crowdWidth * 1.1;
            const labelStartX = crowdX - (totalLabelSpacing / 2);
            const labelSpacing = totalLabelSpacing / 6;
            
            const labels: Phaser.GameObjects.Text[] = [];

            for (let i = 1; i <= 7; i++) {
              const labelText = `${prefix} ${i}`;
              
              const personLabel = this.add.text(
                labelStartX + ((i-1) * labelSpacing),
                crowdY - (crowdWidth * 0.27),
                labelText,
                {
                  fontFamily: 'Arial',
                  fontSize: `${Math.max(Math.min(this.width * 0.008, 12), 8)}px`,
                  color: '#ffffff',
                  stroke: '#000000',
                  strokeThickness: 2,
                  shadow: { 
                    color: '#000000',
                    fill: true,
                    blur: 1,
                    offsetX: 1,
                    offsetY: 1
                  }
                }
              );
              personLabel.setOrigin(0.5);
              personLabel.setDepth(999);
              
              this.tweens.add({
                targets: personLabel,
                y: '+=4',
                duration: 1000,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1
              });
              
              labels.push(personLabel);
            }
            return labels;
          }

          private createBaris1Labels(crowdX: number, crowdY: number, startIndex: number): Phaser.GameObjects.Text[] {
            const crowdWidth = 256 * this.crowdScale;
            const totalLabelSpacing = crowdWidth * 1.1;
            const labelStartX = crowdX - (totalLabelSpacing / 2);
            const labelSpacing = totalLabelSpacing / 6;
            
            const labels: Phaser.GameObjects.Text[] = [];

            for (let i = 1; i <= 7; i++) {
              const userIndex = startIndex + i - 1;
              const user = baris1Users[userIndex];
              let labelText = user ? `${user.username} 💎${user.totalDiamonds}` : `Baris 1 ${i}`;
              
              const personLabel = this.add.text(
                labelStartX + ((i-1) * labelSpacing),
                crowdY - (crowdWidth * 0.27),
                labelText,
                {
                  fontFamily: 'Arial',
                  fontSize: `${Math.max(Math.min(this.width * 0.008, 12), 8)}px`,
                  color: '#ffffff',
                  stroke: '#000000',
                  strokeThickness: 2,
                  shadow: { 
                    color: '#000000',
                    fill: true,
                    blur: 1,
                    offsetX: 1,
                    offsetY: 1
                  }
                }
              );
              personLabel.setOrigin(0.5);
              personLabel.setDepth(999);
              
              this.tweens.add({
                targets: personLabel,
                y: '+=4',
                duration: 1000,
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1
              });
              
              labels.push(personLabel);
            }
            return labels;
          }

          private updateBaris1Labels() {
            this.baris1Labels.forEach((label, index) => {
              const user = baris1Users[index];
              if (user) {
                label.setText(`${user.username} 💎${user.totalDiamonds}`);
              } else {
                label.setText(`Baris 1 ${index + 1}`);
              }
            });
          }

          private updateBaris2Labels() {
            if (!this.baris2Labels) return;
            
            this.baris2Labels.forEach((label, index) => {
              if (!label || !label.setText) return;
              
              const user = this.currentBaris2Data[index];
              if (user) {
                label.setText(user.username);
              } else {
                label.setText('Guest');
              }
            });
          }

          shutdown() {
            if (this.equalizerTimer) {
              this.equalizerTimer.destroy();
            }
            if (this.strobeTimer) {
              this.strobeTimer.destroy();
            }
            if (this.characterTween) {
              this.characterTween.stop();
              this.characterTween.remove();
            }
          }
        }

        const config: Phaser.Types.Core.GameConfig = {
          type: Phaser.AUTO,
          scale: {
            mode: Phaser.Scale.RESIZE,
            parent: 'phaser-container',
            width: 1920,
            height: 1080,
            autoCenter: Phaser.Scale.CENTER_BOTH,
            expandParent: true,
            min: {
              width: 1280,
              height: 720
            },
            max: {
              width: 1920,
              height: 1080
            }
          },
          backgroundColor: '#000000',
          physics: {
            default: 'arcade',
            arcade: {
              gravity: { x: 0, y: 0 },
              debug: false
            }
          },
          scene: CharacterScene,
          audio: {
            noAudio: true
          }
        };

        if (!isComponentMounted) return;

        game = new Phaser.Game(config);

        const resizeGame = () => {
          if (!isComponentMounted) return;
          const width = window.innerWidth;
          const height = window.innerHeight;
          game.scale.resize(width, height);
        };

        resizeGame();
        window.addEventListener('resize', resizeGame);

      } catch (error) {
        if (isComponentMounted) {
          console.error('Error initializing Phaser:', error);
        }
      }
    };

    initPhaser();

    // Cleanup function
    return () => {
      isComponentMounted = false;
      
      // Clear interval
      if (pollInterval) {
        clearInterval(pollInterval);
      }

      // Cleanup socket
      if (socket) {
        socket.disconnect();
      }

      // Cleanup game
      if (game) {
        game.destroy(true);
      }

      // Reset scene reference only
      gameScene = null;
    };
  }, []);

  return <div id="phaser-container" className="w-full h-full"></div>;
}